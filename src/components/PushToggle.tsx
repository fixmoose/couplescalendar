"use client";

import clsx from "clsx";
import { Bell, BellOff, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { disablePush, enablePush, pushEnabled, pushSupported } from "@/lib/push";
import { useStore } from "@/lib/store";

/** Turns browser push on for this device — the part that survives a closed tab. */
export function PushToggle() {
  const { supabase } = useStore();
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

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
    if (on) {
      await disablePush(supabase);
      setOn(false);
    } else {
      const result = await enablePush(supabase);
      if (result.ok) setOn(true);
      else
        setNote(
          result.reason === "denied"
            ? "Your browser is blocking notifications for this site — allow them in the address bar."
            : "Could not turn them on.",
        );
    }
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
    </div>
  );
}
