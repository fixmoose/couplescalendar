"use client";

import clsx from "clsx";
import { addDays, format, isToday, startOfDay } from "date-fns";
import { CalendarX2, MapPin } from "lucide-react";
import { useMemo } from "react";
import { colorVar } from "@/lib/colors";
import { occursOn, rangeLabel } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { useEventColor } from "./EventPill";
import { Avatar } from "./ui";
import type { ViewHandlers } from "./view-types";

const HORIZON_DAYS = 60;

function Row({
  event,
  handlers,
}: {
  event: CalendarEvent;
  handlers: ViewHandlers;
}) {
  const { calendarById, personById } = useStore();
  const color = useEventColor(event);
  const calendar = calendarById(event.calendarId);

  return (
    <button
      type="button"
      onClick={() => handlers.onOpenEvent(event)}
      onContextMenu={(e) => handlers.onEventMenu(e, event)}
      style={colorVar(color)}
      className={clsx(
        "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition hover:bg-surface-2",
        handlers.selectedId === event.id && "bg-surface-2",
      )}
    >
      <span className="cc-dot h-2.5 w-2.5 shrink-0 rounded-full" />
      <span className="w-[132px] shrink-0 text-[13px] text-ink-muted tabular-nums">
        {rangeLabel(event)}
      </span>
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-ink">
        {event.title}
      </span>
      {event.location && (
        <span className="hidden items-center gap-1 text-[12px] text-ink-faint sm:flex">
          <MapPin size={12} /> {event.location}
        </span>
      )}
      <span className="hidden w-28 shrink-0 truncate text-right text-[12px] text-ink-faint md:block">
        {calendar?.name}
      </span>
      <span className="flex w-16 shrink-0 justify-end -space-x-1.5">
        {event.sharedWith.map((id) => {
          const person = personById(id);
          return person ? (
            <Avatar
              key={id}
              person={person}
              size={20}
              className="ring-2 ring-[var(--surface)]"
            />
          ) : null;
        })}
      </span>
    </button>
  );
}

export function AgendaView({
  date,
  events,
  handlers,
}: {
  date: Date;
  events: CalendarEvent[];
  handlers: ViewHandlers;
}) {
  const groups = useMemo(() => {
    const from = startOfDay(date);
    return Array.from({ length: HORIZON_DAYS }, (_, i) => addDays(from, i))
      .map((day) => ({
        day,
        items: events
          .filter((e) => occursOn(e, day))
          .sort(
            (a, b) =>
              Number(b.allDay) - Number(a.allDay) ||
              new Date(a.start).getTime() - new Date(b.start).getTime(),
          ),
      }))
      .filter((g) => g.items.length > 0);
  }, [date, events]);

  return (
    <div className="cc-scroll min-h-0 flex-1 overflow-y-auto bg-surface">
      <div className="mx-auto max-w-3xl px-5 py-6">
        {groups.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <CalendarX2 size={30} className="text-ink-faint" />
            <p className="text-[14px] text-ink-muted">
              Nothing scheduled in the next {HORIZON_DAYS} days.
            </p>
          </div>
        )}

        {groups.map(({ day, items }) => (
          <section key={day.toISOString()} className="mb-5 flex gap-5">
            <div className="w-20 shrink-0 pt-2 text-right">
              <div
                className={clsx(
                  "text-[22px] leading-none font-semibold tabular-nums",
                  isToday(day) ? "text-brand" : "text-ink",
                )}
              >
                {format(day, "d")}
              </div>
              <div className="mt-1 text-[11px] font-medium tracking-wide text-ink-faint uppercase">
                {format(day, "EEE MMM")}
              </div>
            </div>
            <div className="min-w-0 flex-1 border-l border-line pl-2">
              {items.map((event) => (
                <Row key={event.id} event={event} handlers={handlers} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
