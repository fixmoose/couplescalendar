"use client";

import { format } from "date-fns";
import { AlertTriangle, Bell, BellOff, Check, Clock, ListTodo, MapPin } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import type { CalendarEvent, Reminder } from "@/lib/types";
import { listMeta } from "./EventList";
import { describeReminder } from "./RemindersField";
import { Button } from "./ui";

/**
 * Reminders, behaving like notifications: they stay until they are answered,
 * several stack, and each takes one of two answers.
 *
 * Answering is recorded centrally rather than per browser, so a reminder
 * confirmed on a phone disappears from the laptop by itself — nobody should
 * dismiss the same thing twice.
 */

const TICK_MS = 30_000;
/** Anything older than this came due while everything was closed. */
const STALE_AFTER_MS = 12 * 60 * 60 * 1000;

function subscribePermission(onChange: () => void) {
  const id = window.setInterval(onChange, 2000);
  return () => window.clearInterval(id);
}

interface Due {
  event: CalendarEvent;
  reminder: Reminder;
  /** The occurrence this is for, which is what gets acknowledged. */
  dueAt: string;
  key: string;
}

export function ReminderWatcher() {
  const store = useStore();
  const [now, setNow] = useState(() => Date.now());
  const [asked, setAsked] = useState(false);
  /** Which reminders this tab has already rung for. */
  const rung = useRef<Set<string>>(new Set());

  const permission = useSyncExternalStore(
    subscribePermission,
    () => (typeof Notification === "undefined" ? "denied" : Notification.permission),
    () => "denied" as NotificationPermission,
  );

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  // Everything due and unanswered, oldest first — derived rather than stored,
  // so an acknowledgement from another device removes it here as well.
  const due = useMemo(() => {
    const answered = new Set(store.acknowledged);
    const out: Due[] = [];

    for (const event of store.visibleEvents) {
      if (event.masked || !event.reminders?.length) continue;
      const start = new Date(event.start).getTime();

      for (const reminder of event.reminders) {
        if (reminder.channel !== "browser") continue;
        const fireAt = start - reminder.minutesBefore * 60_000;
        if (fireAt > now || now - fireAt > STALE_AFTER_MS) continue;

        const dueAt = new Date(fireAt).toISOString();
        const key = `${reminder.id}:${dueAt}`;
        if (answered.has(key)) continue;

        out.push({ event, reminder, dueAt, key });
      }
    }

    return out.sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
  }, [store.visibleEvents, store.acknowledged, now]);

  // Ring the operating system once per reminder, when the tab is not in front.
  useEffect(() => {
    if (permission !== "granted" || document.visibilityState === "visible") return;

    for (const d of due) {
      if (rung.current.has(d.key)) continue;
      rung.current.add(d.key);
      new Notification(d.event.title, {
        body: `${describeReminder(d.reminder.minutesBefore)} · ${format(new Date(d.event.start), "EEE d MMM, HH:mm")}`,
        tag: d.key,
        icon: "/icon-192.png",
        requireInteraction: true,
      });
    }
  }, [due, permission]);

  const answer = useCallback(
    (item: Due) => store.acknowledgeReminder(item.reminder.id, item.dueAt),
    [store],
  );

  if (!due.length) {
    const wants =
      permission === "default" &&
      !asked &&
      store.visibleEvents.some((e) => e.reminders?.some((r) => r.channel === "browser"));
    if (!wants) return null;

    return (
      <div className="cc-pop fixed right-5 bottom-5 z-50 flex max-w-[320px] items-start gap-3 rounded-xl border border-line bg-surface p-3 shadow-[var(--shadow-md)]">
        <Bell size={16} className="mt-0.5 shrink-0 text-brand" />
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-ink">Turn on reminders?</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">
            Your events have reminders set. Allow notifications and you will be
            told in time.
          </p>
          <div className="mt-2 flex gap-2">
            <Button
              variant="primary"
              className="h-8"
              onClick={() => {
                setAsked(true);
                void Notification.requestPermission();
              }}
            >
              Allow
            </Button>
            <Button variant="ghost" className="h-8" onClick={() => setAsked(true)}>
              Not now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[68] flex justify-center p-4 sm:inset-x-auto sm:right-5 sm:bottom-5 sm:justify-end sm:p-0">
      <div className="cc-scroll pointer-events-auto flex max-h-[70vh] w-full max-w-[380px] flex-col gap-2 overflow-y-auto">
        {due.length > 1 && (
          <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-1.5 text-[12px] shadow-[var(--shadow-sm)]">
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
              {due.length}
            </span>
            <span className="text-ink-muted">reminders waiting</span>
            <button
              type="button"
              onClick={() => due.forEach(answer)}
              className="ml-auto font-medium text-brand hover:underline"
            >
              Confirm all seen
            </button>
          </div>
        )}

        {due.map((item) => {
          const { event, reminder } = item;
          const start = new Date(event.start);
          const mine = event.createdBy === store.currentUserId;
          const author = store.personById(event.createdBy);
          const left = (event.items ?? []).filter((i) => !i.done).length;
          const later = (event.reminders ?? [])
            .filter((r) => r.minutesBefore < reminder.minutesBefore)
            .sort((a, b) => b.minutesBefore - a.minutesBefore)[0];

          return (
            <div
              key={item.key}
              className="cc-pop overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lg)]"
            >
              <div className="p-3.5">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-brand uppercase">
                  <Bell size={13} /> {describeReminder(reminder.minutesBefore)}
                  {event.importance === "urgent" && (
                    <span className="ml-auto flex items-center gap-1 text-[#d1443c]">
                      <AlertTriangle size={12} /> urgent
                    </span>
                  )}
                </div>

                <h2 className="mt-1.5 text-[17px] leading-tight font-bold text-ink">
                  {event.title}
                </h2>

                <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
                  <Clock size={13} />
                  {event.allDay
                    ? format(start, "EEEE d MMMM")
                    : format(start, "EEEE d MMMM · HH:mm")}
                </p>
                {event.location && (
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-[13px] text-ink-muted">
                    <MapPin size={13} />
                    {event.location}
                  </p>
                )}
                {left > 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-brand">
                    <ListTodo size={13} />
                    {listMeta(event.listKind).outstanding(left)}
                  </p>
                )}
                {!mine && author && (
                  <p className="mt-1 text-[12px] text-ink-faint">Set by {author.name}</p>
                )}
                {later && (
                  <p className="mt-2 rounded-lg bg-surface-2 px-2.5 py-1.5 text-[12px] leading-relaxed text-ink-muted">
                    You will be reminded again{" "}
                    {describeReminder(later.minutesBefore).toLowerCase()}.
                  </p>
                )}
              </div>

              <div className="flex gap-2 border-t border-line px-3 py-2">
                <Button
                  variant="primary"
                  className="h-9 flex-1 justify-center text-[13px]"
                  onClick={() => {
                    answer(item);
                    window.dispatchEvent(
                      new CustomEvent("cc:open-event", { detail: event.id }),
                    );
                  }}
                >
                  See the event in the calendar
                </Button>
                <Button
                  variant="outline"
                  className="h-9 shrink-0 text-[13px]"
                  onClick={() => answer(item)}
                >
                  <Check size={14} /> Confirmed seen
                </Button>
              </div>

              {mine && later && (
                <button
                  type="button"
                  onClick={() => {
                    store.setEventReminders(
                      event.id,
                      (event.reminders ?? [])
                        .filter((r) => r.id !== later.id)
                        .map((r) => ({
                          minutesBefore: r.minutesBefore,
                          channel: r.channel,
                          forEveryone: !r.userId,
                        })),
                    );
                    answer(item);
                  }}
                  className="flex w-full items-center justify-center gap-1.5 border-t border-line py-1.5 text-[12px] text-ink-faint hover:bg-surface-2 hover:text-ink"
                >
                  <BellOff size={12} /> Turn off the next one too
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
