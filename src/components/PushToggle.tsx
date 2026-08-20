"use client";

import clsx from "clsx";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { useStore } from "@/lib/store";
import { NotificationHelp } from "./NotificationHelp";
import { PushDevices } from "./PushDevices";

const isEdge = () =>
  typeof navigator !== "undefined" && /\bEdg\//.test(navigator.userAgent);

/** What to actually do about it, per browser. */
function advice(reason: string, detail?: string) {
  if (reason === "no-key") {
    return "Push is not configured on the server yet (VAPID keys missing).";
  }
  if (reason === "dismissed" || reason === "denied") {
    if (isEdge()) {
      return reason === "dismissed"
        ? "Edge blocked the request before it appeared. Open edge://settings/content/notifications, make sure notifications are allowed and this site is not in the block list, then try again."
        : "Edge is blocking notifications for this site. Click the lock icon in the address bar → Permissions for this site → Notifications → Allow. Also check Windows Settings → System → Notifications that Edge is allowed.";
    }
    return "Your browser is blocking notifications for this site — click the lock icon in the address bar and allow them.";
  }
  if (reason === "worker-failed") {
    return `The service worker could not start${detail ? `: ${detail}` : "."}`;
  }
  if (reason === "subscribe-failed") {
    return isEdge()
      ? `Edge refused the subscription${detail ? `: ${detail}` : ""}. This is usually Windows notifications being off for Edge — Windows Settings → System → Notifications.`
      : `Could not subscribe${detail ? `: ${detail}` : "."}`;
  }
  if (reason === "save-failed") return "Subscribed, but the device could not be saved.";
  return "This browser cannot receive push notifications.";
}

/** Turns browser push on for this device — the part that survives a closed tab. */
export function PushToggle() {
  const { supabase } = useStore();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  // Bumped whenever this device subscribes or unsubscribes, so the list below
  // reflects what just happened.
  const [changed, setChanged] = useState(0);

  useEffect(() => {
    void pushEnabled().then(setOn);
  }, []);

  if (!pushSupported()) {
    return (
      <p className="text-[12px] text-ink-faint">
        This browser cannot receive push notifications.
      </p>
    );
  }

  const toggle = async () => {
    setBusy(true);
    setNote(null);
    setShowHelp(false);

    // Some browsers never answer the prompt — they suppress it. Say so rather
    // than leaving a spinner going.
    const timeout = window.setTimeout(() => {
      setBusy(false);
      setNote("Your browser did not answer the request — it may be suppressing it.");
      setShowHelp(true);
    }, 12_000);
    if (on) {
      await disablePush(supabase);
      setOn(false);
      setChanged((n) => n + 1);
    } else {
      const result = await enablePush(supabase);
      if (result.ok) {
        setOn(true);
        setChanged((n) => n + 1);
      } else {
        setNote(advice(result.reason, "error" in result ? result.error : undefined));
        setShowHelp(true);
        // Record it, so a browser that refuses quietly can still be diagnosed.
        void fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            operation: "push-enable",
            code: result.reason,
            message: "error" in result ? result.error : "",
            detail: navigator.userAgent.slice(0, 160),
          }),
        }).catch(() => {});
      }
    }
    window.clearTimeout(timeout);
    setBusy(false);
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={busy || on === null}
        className={clsx(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-[13px] transition",
          on
            ? "border-brand/50 bg-brand-soft font-medium text-brand"
            : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        {busy ? (
          <Loader2 size={14} className="animate-spin" />
        ) : on ? (
          <Bell size={14} />
        ) : (
          <BellOff size={14} />
        )}
        {on ? "Notifications are on" : "Turn on notifications"}
      </button>
      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-faint">
        {on
          ? "Shared events pop up on this device even when the calendar is closed."
          : "Get a pop-up when somebody shares an event, even with the calendar closed."}
      </p>
      {note && <p className="mt-1 text-[12px] text-[#d1443c]">{note}</p>}

      {!on && (
        <button
          type="button"
          onClick={() => setShowHelp((v) => !v)}
          className="mt-1.5 text-[12px] font-medium text-brand hover:underline"
        >
          {showHelp ? "Hide instructions" : "It is not working — what do I do?"}
        </button>
      )}

      {showHelp && <NotificationHelp className="mt-2" />}

      <PushDevices refreshKey={changed} />
    </div>
  );
}
