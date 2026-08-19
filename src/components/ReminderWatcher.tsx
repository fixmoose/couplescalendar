"use client";

import { format } from "date-fns";
import { Bell, BellOff, Clock, ListTodo, MapPin } from "lucide-react";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useStore } from "@/lib/store";
import type { CalendarEvent, Reminder } from "@/lib/types";
import { listMeta } from "./EventList";
import { describeReminder } from "./RemindersField";
import { Button } from "./ui";

/**
 * Fires reminders while the app is open.
 *
 * Browser notifications only reach a tab that is running, which is why this is
 * a stopgap until the app can hold a push subscription. Anything already shown
 * is recorded per (reminder, occurrence) so it does not repeat on a refresh.
 */

/** Permission changes are rare; poll gently so the prompt can disappear. */
function subscribePermission(onChange: () => void) {
  const id = window.setInterval(onChange, 2000);
  return () => window.clearInterval(id);
}

const SEEN_KEY = "cc.reminders.seen";
const TICK_MS = 30_000;
/** Ignore anything that came due while the tab was closed for a long time. */
const STALE_AFTER_MS = 60 * 60 * 1000;

function loadSeen(): Record<string, number> {
  try {
    return JSON.parse(window.localStorage.getItem(SEEN_KEY) ?? "{}");
  } catch {
    return {};
  }
}

function remember(key: string) {
  try {
    const seen = loadSeen();
    seen[key] = Date.now();
    // Keep the ledger from growing forever.
    const cutoff = Date.now() - 30 * 86400_000;
    for (const [k, at] of Object.entries(seen)) if (at < cutoff) delete seen[k];
    window.localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  } catch {
    /* private mode — reminders may repeat, which is the safe direction */
  }
}

interface Due {
  event: CalendarEvent;
  reminder: Reminder;
  key: string;
}

export function ReminderWatcher() {
  const store = useStore();
  const [due, setDue] = useState<Due | null>(null);
  const [asked, setAsked] = useState(false);

  // Notification.permission is browser state, not React state.
  const permission = useSyncExternalStore(
    subscribePermission,
    () => (typeof Notification === "undefined" ? "denied" : Notification.permission),
    () => "denied" as NotificationPermission,
  );

  const check = useCallback(() => {
    const now = Date.now();
    const seen = loadSeen();

    for (const event of store.visibleEvents) {
      if (event.masked || !event.reminders?.length) continue;
      const start = new Date(event.start).getTime();

      for (const reminder of event.reminders) {
        if (reminder.channel !== "browser") continue;
        const fireAt = start - reminder.minutesBefore * 60_000;
        const key = `${reminder.id}:${event.start}`;
        if (seen[key] || fireAt > now || now - fireAt > STALE_AFTER_MS) continue;

        remember(key);
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          const notification = new Notification(event.title, {
            body: `${describeReminder(reminder.minutesBefore)} · ${format(new Date(event.start), "EEE d MMM, HH:mm")}${event.location ? `\n${event.location}` : ""}`,
            tag: key,
            icon: "/logo-mark.png",
          });
          notification.onclick = () => window.focus();
        }
        setDue({ event, reminder, key });
        return;
      }
    }
  }, [store.visibleEvents]);

  useEffect(() => {
    // First pass on the next tick, so the effect itself sets no state.
    const first = window.setTimeout(check, 0);
    const id = window.setInterval(check, TICK_MS);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [check]);

  if (!due) {
    // Ask once, unobtrusively, when there is something to remind about.
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
            Your events have reminders set. Allow notifications and this tab
            will let you know in time.
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

  const { event, reminder } = due;
  const start = new Date(event.start);
  const isMine = event.createdBy === store.currentUserId;
  const author = store.personById(event.createdBy);

  // What else is still to come for this event, so we can say so.
  const later = (event.reminders ?? [])
    .filter((r) => r.minutesBefore < reminder.minutesBefore)
    .sort((a, b) => b.minutesBefore - a.minutesBefore)[0];

  return (
    <div className="cc-fade fixed inset-0 z-[70] flex items-end justify-center bg-black/25 p-4 sm:items-center">
      <div className="cc-pop w-full max-w-[400px] rounded-2xl border border-line bg-surface p-5 shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 text-[12px] font-semibold tracking-wide text-brand uppercase">
          <Bell size={14} /> {describeReminder(reminder.minutesBefore)}
        </div>

        <h2 className="mt-2 text-[19px] leading-tight font-bold text-ink">{event.title}</h2>

        <p className="mt-1.5 flex items-center gap-1.5 text-[13px] text-ink-muted">
          <Clock size={13} />
          {event.allDay
            ? format(start, "EEEE d MMMM")
            : format(start, "EEEE d MMMM · HH:mm")}
        </p>
        {event.location && (
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-muted">
            <MapPin size={13} />
            {event.location}
          </p>
        )}
        {(() => {
          const left = (event.items ?? []).filter((i) => !i.done).length;
          if (!left) return null;
          return (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] font-medium text-brand">
              <ListTodo size={14} />
              {listMeta(event.listKind).outstanding(left)}
            </p>
          );
        })()}

        {!isMine && author && (
          <p className="mt-1 text-[12px] text-ink-faint">Set by {author.name}</p>
        )}

        {later && (
          <p className="mt-3 rounded-lg bg-surface-2 px-3 py-2 text-[12px] leading-relaxed text-ink-muted">
            You will be reminded again {describeReminder(later.minutesBefore).toLowerCase()}.
            {!isMine && " Only the person who created this can change that."}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <Button
            variant="primary"
            className="flex-1 justify-center"
            onClick={() => setDue(null)}
          >
            OK
          </Button>
          {later && (!later.userId ? isMine : true) && (
            <Button
              variant="outline"
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
                setDue(null);
              }}
            >
              <BellOff size={15} /> Turn that one off
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
