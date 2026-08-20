"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

/**
 * Who is looking at their calendar right now.
 *
 * Uses Supabase's presence channel: each browser announces itself and hears
 * about the others, with nothing stored. Green means the calendar is open and
 * being used; amber means it is open but they have wandered off, which is the
 * honest distinction — it says nothing about whether they are at their desk.
 */

export type Presence = "active" | "away";

/** How long without a keystroke or a click before "away". */
const IDLE_AFTER_MS = 5 * 60 * 1000;
const CHANNEL = "cc-presence";

export function usePresence(supabase: SupabaseClient, userId: string | undefined) {
  const [people, setPeople] = useState<Record<string, Presence>>({});
  const [mine, setMine] = useState<Presence>("active");

  useEffect(() => {
    if (!userId) return;

    let state: Presence = "active";
    let lastActive = Date.now();
    let idleTimer: number | null = null;

    const channel = supabase.channel(CHANNEL, {
      config: { presence: { key: userId } },
    });

    const publish = (next: Presence) => {
      if (next === state) return;
      state = next;
      setMine(next);
      void channel.track({ status: next, at: Date.now() });
    };

    const readState = () => {
      const raw = channel.presenceState<{ status?: Presence }>();
      const next: Record<string, Presence> = {};
      for (const [key, entries] of Object.entries(raw)) {
        // Any window of theirs being active counts as active.
        next[key] = entries.some((e) => e.status !== "away") ? "active" : "away";
      }
      setPeople(next);
    };

    channel
      .on("presence", { event: "sync" }, readState)
      .on("presence", { event: "join" }, readState)
      .on("presence", { event: "leave" }, readState)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") void channel.track({ status: "active", at: Date.now() });
      });

    const touch = () => {
      lastActive = Date.now();
      if (document.visibilityState === "visible") publish("active");
    };

    const check = () => {
      if (document.visibilityState !== "visible" || Date.now() - lastActive > IDLE_AFTER_MS) {
        publish("away");
      }
    };

    for (const event of ["pointerdown", "keydown", "wheel", "focus"]) {
      window.addEventListener(event, touch, { passive: true });
    }
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") touch();
      else publish("away");
    });

    idleTimer = window.setInterval(check, 30_000);

    return () => {
      if (idleTimer) window.clearInterval(idleTimer);
      for (const event of ["pointerdown", "keydown", "wheel", "focus"]) {
        window.removeEventListener(event, touch);
      }
      void supabase.removeChannel(channel);
    };
  }, [supabase, userId]);

  return { people, mine };
}
