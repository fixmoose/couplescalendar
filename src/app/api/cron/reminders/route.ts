import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Sends the email reminders that have come due.
 *
 * Browser reminders fire in the open tab (see ReminderWatcher); these are the
 * ones that must arrive whether or not the app is running. Every send is
 * recorded in cc_reminder_deliveries, so a re-run inside the same window does
 * not send twice.
 */
export const maxDuration = 60;

/** How late a reminder may be sent before it is pointless. */
const GRACE_MINUTES = 90;

interface DueRow {
  id: string;
  minutes_before: number;
  event: {
    id: string;
    title: string;
    starts_at: string;
    location: string | null;
    all_day: boolean;
    created_by: string;
    calendar_id: string;
  };
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET is not set — refusing to run unprotected." },
        { status: 503 },
      );
    }
  } else {
    const ok =
      request.headers.get("authorization") === `Bearer ${secret}` ||
      new URL(request.url).searchParams.get("key") === secret;
    if (!ok) return NextResponse.json({ error: "Not authorised." }, { status: 401 });
  }

  const apiKey = process.env.UNIONE_API_KEY;
  const admin = createAdminClient();
  const now = Date.now();

  // Only events close enough that some reminder could plausibly be due.
  const horizon = new Date(now + 31 * 86400_000).toISOString();
  const { data, error } = await admin
    .from("cc_event_reminders")
    .select(
      "id,minutes_before,event:cc_events!inner(id,title,starts_at,location,all_day,created_by,calendar_id)",
    )
    .eq("channel", "email")
    .gte("cc_events.starts_at", new Date(now - GRACE_MINUTES * 60_000).toISOString())
    .lte("cc_events.starts_at", horizon);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []) as unknown as DueRow[];
  const due = rows.filter((row) => {
    const fireAt = new Date(row.event.starts_at).getTime() - row.minutes_before * 60_000;
    return fireAt <= now && now - fireAt <= GRACE_MINUTES * 60_000;
  });

  let sent = 0;
  const skipped: string[] = [];

  for (const row of due) {
    // Everyone the event reaches: its creator, whoever it was shared with, and
    // the members of the group owning the calendar.
    const recipients = new Set<string>([row.event.created_by]);

    const [{ data: shares }, { data: calendar }] = await Promise.all([
      admin.from("cc_event_shares").select("user_id").eq("event_id", row.event.id),
      admin
        .from("cc_calendars")
        .select("group_id")
        .eq("id", row.event.calendar_id)
        .single(),
    ]);
    for (const s of shares ?? []) recipients.add(s.user_id as string);

    if (calendar?.group_id) {
      const { data: members } = await admin
        .from("cc_group_members")
        .select("user_id")
        .eq("group_id", calendar.group_id);
      for (const m of members ?? []) recipients.add(m.user_id as string);
    }

    const dueAt = new Date(
      new Date(row.event.starts_at).getTime() - row.minutes_before * 60_000,
    ).toISOString();

    for (const userId of recipients) {
      // The delivery row is the lock: if it inserts, we own this send.
      const { error: claimError } = await admin
        .from("cc_reminder_deliveries")
        .insert({ reminder_id: row.id, user_id: userId, due_at: dueAt });
      if (claimError) continue; // already sent

      const { data: profile } = await admin
        .from("cc_profiles")
        .select("email,display_name")
        .eq("id", userId)
        .single();
      if (!profile?.email) continue;

      if (!apiKey) {
        skipped.push(profile.email as string);
        continue;
      }

      const when = new Date(row.event.starts_at).toLocaleString("en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: row.event.all_day ? undefined : "2-digit",
        minute: row.event.all_day ? undefined : "2-digit",
      });

      await fetch(
        process.env.UNIONE_API_URL ??
          "https://us1.unione.io/en/transactional/api/v1/email/send.json",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
          body: JSON.stringify({
            message: {
              recipients: [{ email: profile.email }],
              template_engine: "simple",
              subject: `Reminder: ${row.event.title} — ${when}`,
              from_email: process.env.UNIONE_FROM_EMAIL ?? "no-reply@docmaker.studio",
              from_name: process.env.UNIONE_FROM_NAME ?? "CouplesCalendar",
              body: {
                html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px">
                  <h2 style="margin:0 0 6px;font-size:19px;color:#1a1a1e">${escapeHtml(row.event.title)}</h2>
                  <p style="margin:0 0 4px;color:#6b6b76;font-size:15px">${escapeHtml(when)}</p>
                  ${row.event.location ? `<p style="margin:0 0 4px;color:#6b6b76;font-size:15px">${escapeHtml(row.event.location)}</p>` : ""}
                  <p style="margin:18px 0 0"><a href="https://calendar.docmaker.studio/calendar" style="background:#dc6b15;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Open the calendar</a></p>
                </div>`,
              },
              track_links: 0,
              track_read: 0,
            },
          }),
        },
      ).catch(() => null);

      sent += 1;
    }
  }

  const pushed = await pushDueReminders(admin);
  const notified = await pushPendingNotifications(admin);
  const mailed = await flushNotificationEmails(admin, apiKey);

  return NextResponse.json({
    considered: rows.length,
    due: due.length,
    sent,
    remindersPushed: pushed,
    notificationsPushed: notified,
    notificationsEmailed: mailed,
    ...(skipped.length ? { skippedNoMailKey: skipped.length } : {}),
  });
}

/**
 * Pushes the browser reminders that have come due, so they arrive with the
 * calendar closed. Answering one anywhere records an acknowledgement, and the
 * delivery row keeps this from sending the same occurrence twice.
 */
async function pushDueReminders(admin: ReturnType<typeof createAdminClient>) {
  if (!configuredPush()) return 0;

  const now = Date.now();
  const { data } = await admin
    .from("cc_event_reminders")
    .select(
      "id,minutes_before,user_id,event:cc_events!inner(id,title,starts_at,location,all_day,created_by,calendar_id,deleted_at)",
    )
    .eq("channel", "browser")
    .gte("cc_events.starts_at", new Date(now - GRACE_MINUTES * 60_000).toISOString())
    .lte("cc_events.starts_at", new Date(now + 31 * 86400_000).toISOString());

  let pushed = 0;

  for (const row of (data ?? []) as unknown as (DueRow & { user_id: string | null })[]) {
    if ((row.event as { deleted_at?: string }).deleted_at) continue;

    const fireAt = new Date(row.event.starts_at).getTime() - row.minutes_before * 60_000;
    if (fireAt > now || now - fireAt > GRACE_MINUTES * 60_000) continue;

    const dueAt = new Date(fireAt).toISOString();

    // Whose reminder: one person's, or everyone the event reaches.
    const recipients = new Set<string>();
    if (row.user_id) {
      recipients.add(row.user_id);
    } else {
      recipients.add(row.event.created_by);
      const [{ data: shares }, { data: calendar }] = await Promise.all([
        admin.from("cc_event_shares").select("user_id").eq("event_id", row.event.id),
        admin.from("cc_calendars").select("group_id").eq("id", row.event.calendar_id).single(),
      ]);
      for (const s of shares ?? []) recipients.add(s.user_id as string);
      if (calendar?.group_id) {
        const { data: members } = await admin
          .from("cc_group_members")
          .select("user_id")
          .eq("group_id", calendar.group_id);
        for (const m of members ?? []) recipients.add(m.user_id as string);
      }
    }

    for (const userId of recipients) {
      // Already answered on some device: say nothing.
      const { data: ack } = await admin
        .from("cc_reminder_acks")
        .select("reminder_id")
        .eq("reminder_id", row.id)
        .eq("user_id", userId)
        .eq("due_at", dueAt)
        .maybeSingle();
      if (ack) continue;

      // The delivery row is the lock.
      const { error: claimError } = await admin
        .from("cc_reminder_deliveries")
        .insert({ reminder_id: row.id, user_id: userId, due_at: dueAt });
      if (claimError) continue;

      const { data: subscriptions } = await admin
        .from("cc_push_subscriptions")
        .select("endpoint,p256dh,auth")
        .eq("user_id", userId);

      const when = new Date(row.event.starts_at).toLocaleString("en-GB", {
        weekday: "short",
        day: "numeric",
        month: "short",
        ...(row.event.all_day ? {} : { hour: "2-digit", minute: "2-digit" }),
      });

      for (const subscription of subscriptions ?? []) {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify({
              // A lock screen has no colour to read, so the words carry it.
              title: `Reminder · ${row.event.title}`,
              body: `${describeMinutes(row.minutes_before)} · ${when}`,
              tag: `reminder:${row.id}:${dueAt}`,
              url: `/calendar?event=${row.event.id}`,
            }),
          );
          pushed += 1;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) {
            await admin
              .from("cc_push_subscriptions")
              .delete()
              .eq("endpoint", subscription.endpoint);
          }
        }
      }
    }
  }

  return pushed;
}

function configuredPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:no-reply@docmaker.studio",
    publicKey,
    privateKey,
  );
  return true;
}

/** "2 hours before" — the same words the app uses. */
function describeMinutes(minutes: number) {
  if (minutes === 0) return "Starting now";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} min before`;
}

/**
 * Pushes any notification that has not gone out yet — a share, an update, a
 * pinned note. The sharer's browser normally asks for delivery the moment it
 * happens; this catches the times it could not, because the tab was closed
 * mid-write, the network dropped, or the trigger fired without a browser
 * behind it at all.
 */
async function pushPendingNotifications(admin: ReturnType<typeof createAdminClient>) {
  if (!configuredPush()) return 0;

  const { data } = await admin
    .from("cc_notifications")
    .select("id,user_id,title,body,event_id")
    .is("pushed_at", null)
    // Old enough that the immediate attempt has had its chance, recent enough
    // to still be worth someone's lock screen.
    .lt("created_at", new Date(Date.now() - 60_000).toISOString())
    .gte("created_at", new Date(Date.now() - 6 * 3600_000).toISOString())
    .limit(100);

  let pushed = 0;

  for (const note of data ?? []) {
    // Claim it first: whatever happens next, it goes out once.
    const { error: claimError } = await admin
      .from("cc_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", note.id)
      .is("pushed_at", null);
    if (claimError) continue;

    const { data: subscriptions } = await admin
      .from("cc_push_subscriptions")
      .select("endpoint,p256dh,auth")
      .eq("user_id", note.user_id);

    for (const subscription of subscriptions ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: note.title,
            body: note.body ?? "",
            tag: note.id,
            url: note.event_id ? `/calendar?event=${note.event_id}` : "/calendar",
          }),
        );
        pushed += 1;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await admin
            .from("cc_push_subscriptions")
            .delete()
            .eq("endpoint", subscription.endpoint);
        }
      }
    }
  }

  return pushed;
}

/**
 * Emails the notifications whose recipient asked to hear about that event by
 * email. In-app notifications are already delivered — this is the extra copy
 * for people who opted in, marked with emailed_at so it goes once.
 */
async function flushNotificationEmails(
  admin: ReturnType<typeof createAdminClient>,
  apiKey: string | undefined,
) {
  const { data } = await admin
    .from("cc_notifications")
    .select("id,user_id,event_id,title,body,created_at")
    .is("emailed_at", null)
    .gte("created_at", new Date(Date.now() - 24 * 3600_000).toISOString())
    .limit(100);

  let mailed = 0;

  for (const note of data ?? []) {
    // Claim it first, so a slow send cannot be duplicated by the next run.
    const { error: claimError } = await admin
      .from("cc_notifications")
      .update({ emailed_at: new Date().toISOString() })
      .eq("id", note.id)
      .is("emailed_at", null);
    if (claimError) continue;

    if (!note.event_id || !apiKey) continue;

    const { data: subscription } = await admin
      .from("cc_event_subscriptions")
      .select("email")
      .eq("event_id", note.event_id)
      .eq("user_id", note.user_id)
      .maybeSingle();
    if (!subscription?.email) continue;

    const { data: profile } = await admin
      .from("cc_profiles")
      .select("email")
      .eq("id", note.user_id)
      .single();
    if (!profile?.email) continue;

    await fetch(
      process.env.UNIONE_API_URL ??
        "https://us1.unione.io/en/transactional/api/v1/email/send.json",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-KEY": apiKey },
        body: JSON.stringify({
          message: {
            recipients: [{ email: profile.email }],
            template_engine: "simple",
            subject: note.title,
            from_email: process.env.UNIONE_FROM_EMAIL ?? "no-reply@docmaker.studio",
            from_name: process.env.UNIONE_FROM_NAME ?? "CouplesCalendar",
            body: {
              html: `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px">
                <h2 style="margin:0 0 6px;font-size:18px;color:#1a1a1e">${escapeHtml(note.title)}</h2>
                ${note.body ? `<p style="margin:0;color:#6b6b76;font-size:15px">${escapeHtml(note.body)}</p>` : ""}
                <p style="margin:18px 0 0"><a href="https://calendar.docmaker.studio/calendar" style="background:#dc6b15;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600;font-size:14px">Open the calendar</a></p>
              </div>`,
            },
            track_links: 0,
            track_read: 0,
          },
        }),
      },
    ).catch(() => null);

    mailed += 1;
  }

  return mailed;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
