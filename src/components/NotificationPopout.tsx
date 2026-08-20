"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { CalendarDays, Check, Clock, MapPin } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import { toneForKind, toneLabel, toneVar } from "./tone";
import type { AppNotification, CalendarEvent } from "@/lib/types";
import { Avatar, Button } from "./ui";

/**
 * An arriving share announces itself, the way a mail client does, rather than
 * quietly incrementing a badge. The bell keeps the history; this is the moment
 * it happens.
 *
 * Notifications arrive over Realtime, so this fires as the share is made. A
 * system notification goes out alongside it when the tab is not in front —
 * and the service worker takes over entirely when the app is closed.
 */
const SEEN_KEY = "cc.popped";

function loadSeen(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(SEEN_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function remember(id: string) {
  try {
    const seen = [...loadSeen(), id].slice(-50);
    window.sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* ignore */
  }
}

/** The small square of colour beside the label. */
function ProvenanceDot() {
  return <span className="cc-dot h-2 w-2 shrink-0 rounded-[3px]" />;
}

export function NotificationPopout({
  onOpenEvent,
}: {
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const store = useStore();
  const [queue, setQueue] = useState<AppNotification[]>([]);
  const known = useRef<Set<string> | null>(null);

  useEffect(() => {
    // The first pass only records what is already there — a page load should
    // not replay every unread notification as a pop-out.
    if (known.current === null) {
      known.current = new Set([
        ...store.notifications.map((n) => n.id),
        ...loadSeen(),
      ]);
      return;
    }

    const fresh = store.notifications.filter(
      (n) => !n.readAt && !known.current!.has(n.id),
    );
    if (!fresh.length) return;

    for (const n of fresh) {
      known.current!.add(n.id);
      remember(n.id);

      // If the tab is not in front, let the operating system say so too.
      if (
        typeof Notification !== "undefined" &&
        Notification.permission === "granted" &&
        document.visibilityState !== "visible"
      ) {
        new Notification(n.title, { body: n.body ?? "", tag: n.id, icon: "/logo-mark.png" });
      }
    }

    // Every one is kept: each concerns a different event and each wants an
    // answer, so none is dropped to make room.
    setQueue((current) => [...fresh, ...current]);
  }, [store.notifications]);



  // Answered anywhere means answered everywhere: a notification marked read on
  // another device is no longer waiting here.
  const unread = new Set(
    store.notifications.filter((n) => !n.readAt).map((n) => n.id),
  );
  const waiting = queue.filter((n) => unread.has(n.id));

  if (!waiting.length) return null;

  const dismiss = (id: string) => setQueue((q) => q.filter((n) => n.id !== id));

  const seeAll = () => {
    store.markNotificationsRead(waiting.map((n) => n.id));
    setQueue([]);
  };

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[65] flex max-h-[calc(100vh-2rem)] w-[340px] max-w-[calc(100vw-2rem)] flex-col gap-2">
      {waiting.length > 1 && (
        <div className="cc-pop pointer-events-auto flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] shadow-[var(--shadow-sm)]">
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
            {waiting.length}
          </span>
          <span className="text-ink-muted">waiting</span>
          <button
            type="button"
            onClick={seeAll}
            className="ml-auto font-medium text-brand hover:underline"
          >
            Confirm all seen
          </button>
        </div>
      )}

      <div className="cc-scroll pointer-events-auto flex min-h-0 flex-col gap-2 overflow-y-auto">
      {waiting.map((n) => {
        const actor = n.actorId ? store.personById(n.actorId) : undefined;
        const event = store.visibleEvents.find((e) => e.id === n.eventId);
        const start = event ? new Date(event.start) : null;

        const tone = toneForKind(n.kind);

        return (
          <div
            key={n.id}
            style={toneVar(tone)}
            className="cc-pop cc-tint-border pointer-events-auto overflow-hidden rounded-xl border-2 bg-surface shadow-[var(--shadow-lg)]"
          >
            {/* The rail is the tell: blue for a share, violet for an invite. */}
            <div className="cc-dot h-1 w-full" />

            <div className="flex items-center gap-1.5 px-3 pt-2">
              <ProvenanceDot />
              <span
                className="text-[10px] font-bold tracking-wider uppercase"
                style={{ color: "var(--c)" }}
              >
                {toneLabel(tone)}
              </span>
            </div>

            <div className="flex items-start gap-2.5 px-3 pt-1.5 pb-3">
              {actor ? (
                <Avatar person={actor} size={30} />
              ) : (
                <span className="cc-tint flex h-[30px] w-[30px] items-center justify-center rounded-full">
                  <CalendarDays size={15} />
                </span>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[13px] leading-snug font-medium text-ink">{n.title}</p>
                {n.body && (
                  <p className="mt-0.5 truncate text-[13px] text-ink-muted">{n.body}</p>
                )}

                {event && start && (
                  <div className="mt-1 space-y-0.5">
                    <p className="flex items-center gap-1.5 text-[12px] text-ink-faint">
                      <Clock size={11} />
                      {event.allDay
                        ? format(start, "EEEE d MMMM")
                        : format(start, "EEE d MMM · HH:mm")}
                    </p>
                    {event.location && (
                      <p className="flex items-center gap-1.5 truncate text-[12px] text-ink-faint">
                        <MapPin size={11} />
                        {event.location}
                      </p>
                    )}
                  </div>
                )}
              </div>


            </div>

            {/* Two answers, and it waits until it gets one. */}
            <div className={clsx("flex gap-2 border-t border-line px-3 py-2")}>
              <Button
                variant="primary"
                className="h-9 flex-1 justify-center text-[13px]"
                disabled={!event}
                onClick={() => {
                  if (!event) return;
                  store.markNotificationsRead([n.id]);
                  dismiss(n.id);
                  onOpenEvent(event);
                }}
              >
                See the event in the calendar
              </Button>
              <Button
                variant="outline"
                className="h-9 shrink-0 text-[13px]"
                title="Mark it read and put it away"
                onClick={() => {
                  store.markNotificationsRead([n.id]);
                  dismiss(n.id);
                }}
              >
                <Check size={14} /> Confirmed seen
              </Button>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}
