"use client";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Browser push: the part that still works when the calendar is closed.
 *
 * An open tab gets notifications straight from Realtime. This registers a
 * service worker and a push subscription so the operating system can show one
 * when there is no tab at all.
 */

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

export const pushSupported = () =>
  typeof window !== "undefined" &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  Boolean(VAPID_PUBLIC_KEY);

/** The key travels as base64url and must reach the browser as bytes. */
function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + "=".repeat((4 - (base64.length % 4)) % 4))
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = window.atob(padded);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerWorker() {
  if (!pushSupported()) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

/** Asks permission if needed, subscribes, and records it against the account. */
export async function enablePush(supabase: SupabaseClient) {
  if (!pushSupported()) return { ok: false, reason: "unsupported" as const };

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") return { ok: false, reason: "denied" as const };

  const registration = (await registerWorker()) ?? (await navigator.serviceWorker.ready);
  if (!registration) return { ok: false, reason: "unsupported" as const };

  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    }));

  const json = subscription.toJSON();
  const { error } = await supabase.from("cc_push_subscriptions").upsert(
    {
      endpoint: subscription.endpoint,
      p256dh: json.keys?.p256dh ?? "",
      auth: json.keys?.auth ?? "",
      user_agent: navigator.userAgent.slice(0, 200),
      last_used_at: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );

  if (error) return { ok: false, reason: "save-failed" as const, error: error.message };
  return { ok: true as const };
}

export async function disablePush(supabase: SupabaseClient) {
  const registration = await navigator.serviceWorker?.getRegistration();
  const subscription = await registration?.pushManager.getSubscription();
  if (subscription) {
    await supabase.from("cc_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
    await subscription.unsubscribe();
  }
}

export async function pushEnabled() {
  if (!pushSupported() || Notification.permission !== "granted") return false;
  const registration = await navigator.serviceWorker?.getRegistration();
  return Boolean(await registration?.pushManager.getSubscription());
}

/** Nudges the server to deliver a notification now, rather than on the cron. */
export async function deliverNow(notificationIds: string[]) {
  if (!notificationIds.length) return;
  try {
    await fetch("/api/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notificationIds }),
    });
  } catch {
    /* the cron will pick it up */
  }
}
