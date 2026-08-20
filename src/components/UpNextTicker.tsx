"use client";

import clsx from "clsx";
import { format, isToday, isTomorrow } from "date-fns";
import { AlertTriangle, EyeOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { colorVar } from "@/lib/colors";
import { timeLabel } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { useEventColor } from "./EventPill";

/**
 * What is coming, sliding past continuously.
 *
 * The track carries the same list twice and travels exactly half its width, so
 * the loop meets itself seamlessly. It pauses on hover — a thing that never
 * stops moving is impossible to click — and stands still for anyone who has
 * asked for reduced motion.
 */

/** Prefer the next fortnight, but never show nothing just because it is quiet. */
const PREFERRED_DAYS = 14;
const MAX_ITEMS = 10;

function whenLabel(event: CalendarEvent) {
  const start = new Date(event.start);
  if (event.allDay) {
    return isToday(start) ? "All day" : format(start, "EEE");
  }
  if (isToday(start)) return timeLabel(start);
  if (isTomorrow(start)) return `Tomorrow ${timeLabel(start)}`;
  return `${format(start, "EEE")} ${timeLabel(start)}`;
}

function Item({ event }: { event: CalendarEvent }) {
  const color = useEventColor(event);
  const store = useStore();
  const owner = event.masked ? store.personById(event.createdBy) : undefined;

  return (
    <button
      type="button"
      style={colorVar(color)}
      onClick={() =>
        window.dispatchEvent(new CustomEvent("cc:open-event", { detail: event.id }))
      }
      className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[12px] transition hover:bg-surface-2"
    >
      {event.masked ? (
        <EyeOff size={11} className="shrink-0 text-ink-faint" />
      ) : (
        <span className="cc-dot h-1.5 w-1.5 shrink-0 rounded-full" />
      )}
      <span className="font-medium text-ink-muted tabular-nums">{whenLabel(event)}</span>
      <span
        className={clsx(
          "max-w-[190px] truncate",
          event.masked ? "text-ink-faint italic" : "text-ink",
        )}
      >
        {event.masked ? `${owner?.name ?? "Someone"} busy` : event.title}
      </span>
      {event.importance === "urgent" && (
        <AlertTriangle size={11} className="shrink-0 text-[#d1443c]" />
      )}
    </button>
  );
}

export function UpNextTicker() {
  const store = useStore();
  // Read once on the client, then moved on by the minute so "up next" stays
  // true without the render itself reaching for the clock.
  const [now, setNow] = useState(() =>
    typeof window === "undefined" ? 0 : Date.now(),
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const upcoming = useMemo(() => {
    const ahead = store.visibleEvents
      .filter((e) => new Date(e.end).getTime() >= now)
      .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

    const soon = ahead.filter(
      (e) => new Date(e.start).getTime() <= now + PREFERRED_DAYS * 86400_000,
    );

    // A quiet fortnight still deserves a ticker: fall back to whatever is next.
    return (soon.length ? soon : ahead).slice(0, MAX_ITEMS);
  }, [store.visibleEvents, now]);

  if (!now || upcoming.length === 0) return null;

  // Slow enough to read, and proportional to how much there is to read.
  const seconds = Math.max(18, upcoming.length * 6);

  return (
    <div className="relative hidden min-w-0 flex-1 overflow-hidden md:block">
      {/* Fade the ends so items arrive and leave rather than being cut off. */}
      <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-[var(--surface)] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-[var(--surface)] to-transparent" />

      <div
        className="cc-marquee flex w-max"
        style={{ animationDuration: `${seconds}s` }}
      >
        {[0, 1].map((copy) => (
          <div key={copy} className="flex shrink-0 gap-1 pr-1" aria-hidden={copy === 1}>
            {upcoming.map((event) => (
              <Item key={`${copy}-${event.id}`} event={event} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
