"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { CalendarDays, Clock, MapPin, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
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

    setQueue((current) => [...fresh, ...current].slice(0, 3));
  }, [store.notifications]);

  if (!queue.length) return null;

  const dismiss = (id: string) => setQueue((q) => q.filter((n) => n.id !== id));

  return (
    <div className="pointer-events-none fixed top-4 right-4 z-[65] flex w-[340px] flex-col gap-2">
      {queue.map((n) => {
        const actor = n.actorId ? store.personById(n.actorId) : undefined;
        const event = store.visibleEvents.find((e) => e.id === n.eventId);
        const start = event ? new Date(event.start) : null;

        return (
          <div
            key={n.id}
            className="cc-pop pointer-events-auto overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lg)]"
          >
            <div className="flex items-start gap-2.5 p-3">
              {actor ? (
                <Avatar person={actor} size={30} />
              ) : (
                <span className="flex h-[30px] w-[30px] items-center justify-center rounded-full bg-brand-soft text-brand">
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

              <button
                type="button"
                onClick={() => {
                  store.markNotificationsRead([n.id]);
                  dismiss(n.id);
                }}
                title="Dismiss"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink"
              >
                <X size={13} />
              </button>
            </div>

            <div className={clsx("flex gap-2 border-t border-line px-3 py-2")}>
              <Button
                variant="primary"
                className="h-8 flex-1 justify-center text-[13px]"
                disabled={!event}
                onClick={() => {
                  if (!event) return;
                  store.markNotificationsRead([n.id]);
                  dismiss(n.id);
                  onOpenEvent(event);
                }}
              >
                See it in my calendar
              </Button>
              <Button
                variant="ghost"
                className="h-8 text-[13px]"
                onClick={() => {
                  store.markNotificationsRead([n.id]);
                  dismiss(n.id);
                }}
              >
                Later
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
