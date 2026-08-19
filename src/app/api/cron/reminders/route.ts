import { NextResponse } from "next/server";
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

  return NextResponse.json({
    considered: rows.length,
    due: due.length,
    sent,
    ...(skipped.length ? { skippedNoMailKey: skipped.length } : {}),
  });
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}
