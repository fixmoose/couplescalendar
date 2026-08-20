"use client";

import clsx from "clsx";
import { formatDistanceToNow } from "date-fns";
import { Bell, Check, Share2, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { toneForKind, toneVar } from "./tone";
import { Avatar } from "./ui";

/**
 * The bell: what happened while you were away.
 *
 * Notifications are rows in the database rather than fire-and-forget toasts,
 * so a share still greets you after a refresh, a new login, or on another
 * device — which is the point until real push arrives.
 */
export function NotificationsMenu({
  onOpenEvent,
}: {
  onOpenEvent: (event: CalendarEvent) => void;
}) {
  const store = useStore();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const unread = store.unreadNotifications;

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!panel.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("pointerdown", close);
    return () => window.removeEventListener("pointerdown", close);
  }, [open]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={unread ? `${unread} new notifications` : "Notifications"}
        className={clsx(
          "relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition",
          open ? "bg-brand-soft text-brand" : "text-ink-muted hover:bg-surface-2 hover:text-ink",
        )}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panel}
          className="cc-pop absolute right-0 z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-md)]"
        >
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <span className="text-[13px] font-semibold text-ink">Notifications</span>
            {store.notifications.length > 0 && (
              <div className="flex items-center gap-1">
                {unread > 0 && (
                  <button
                    type="button"
                    onClick={() =>
                      store.markNotificationsRead(
                        store.notifications.filter((n) => !n.readAt).map((n) => n.id),
                      )
                    }
                    className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink-muted hover:bg-surface-2 hover:text-ink"
                  >
                    <Check size={12} /> Mark all read
                  </button>
                )}
                <button
                  type="button"
                  title="Clear all"
                  onClick={() =>
                    store.clearNotifications(store.notifications.map((n) => n.id))
                  }
                  className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-[#d1443c]"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
          </div>

          <div className="cc-scroll max-h-[380px] overflow-y-auto">
            {store.notifications.length === 0 && (
              <p className="px-3 py-8 text-center text-[13px] text-ink-faint">
                Nothing yet. When somebody shares an event with you, it lands here.
              </p>
            )}

            {store.notifications.map((n) => {
              const actor = n.actorId ? store.personById(n.actorId) : undefined;
              const event = store.visibleEvents.find((e) => e.id === n.eventId);

              return (
                <div
                  key={n.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (!n.readAt) store.markNotificationsRead([n.id]);
                    if (event) {
                      onOpenEvent(event);
                      setOpen(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && event) onOpenEvent(event);
                  }}
                  className={clsx(
                    "group flex w-full items-start gap-2.5 border-b border-line px-3 py-2.5 text-left transition last:border-b-0",
                    n.readAt ? "hover:bg-surface-2" : "bg-brand-soft/40 hover:bg-brand-soft",
                  )}
                >
                  <span className="relative shrink-0" style={toneVar(toneForKind(n.kind))}>
                    {actor ? (
                      <Avatar person={actor} size={26} />
                    ) : (
                      <span className="cc-tint flex h-[26px] w-[26px] items-center justify-center rounded-full">
                        <Share2 size={13} />
                      </span>
                    )}
                    {/* Same colour code as the pop-out it arrived as. */}
                    <span className="cc-dot absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--surface)]" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] leading-snug text-ink">
                      {n.title}
                    </span>
                    {n.body && (
                      <span className="mt-0.5 block truncate text-[12px] font-medium text-ink-muted">
                        {n.body}
                      </span>
                    )}
                    <span className="mt-0.5 block text-[11px] text-ink-faint">
                      {formatDistanceToNow(new Date(n.createdAt))} ago
                    </span>
                  </span>

                  <button
                    type="button"
                    title="Dismiss"
                    onClick={(e) => {
                      e.stopPropagation();
                      store.clearNotifications([n.id]);
                    }}
                    className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
