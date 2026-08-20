import { NextResponse } from "next/server";
import webpush from "web-push";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/**
 * Delivers notifications as browser pushes.
 *
 * Called by the client right after it shares something, so the other person
 * hears about it immediately even with the calendar closed; the reminders cron
 * sweeps up anything this missed.
 */

function configured() {
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

export async function POST(request: Request) {
  if (!configured()) {
    return NextResponse.json(
      { error: "Push is not configured — set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY." },
      { status: 503 },
    );
  }

  // Only a signed-in caller may ask for delivery, and only of notifications
  // that already exist — the payload comes from the database, not the request.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { notificationIds } = (await request.json().catch(() => ({}))) as {
    notificationIds?: string[];
  };
  if (!notificationIds?.length) {
    return NextResponse.json({ error: "Nothing to send." }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: notifications, error } = await admin
    .from("cc_notifications")
    .select("id,user_id,actor_id,title,body,event_id,pushed_at")
    .in("id", notificationIds.slice(0, 20))
    .is("pushed_at", null);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let sent = 0;

  for (const note of notifications ?? []) {
    // The sender may only trigger pushes for notifications they caused.
    if (note.actor_id !== user.id) continue;

    await admin
      .from("cc_notifications")
      .update({ pushed_at: new Date().toISOString() })
      .eq("id", note.id);

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
        sent += 1;
      } catch (e) {
        // 404/410 means the browser threw the subscription away.
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

  return NextResponse.json({ sent });
}
