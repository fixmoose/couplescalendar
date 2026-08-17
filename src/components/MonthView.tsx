"use client";

import clsx from "clsx";
import {
  addDays,
  addHours,
  differenceInCalendarDays,
  format,
  isSameMonth,
  isToday,
  startOfDay,
} from "date-fns";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { layoutWeek, monthMatrix, weekDays } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { EventPill } from "./EventPill";
import type { ViewHandlers } from "./view-types";

const LANE_H = 23;
const HEADER_H = 26;

export function MonthView({
  date,
  events,
  handlers,
}: {
  date: Date;
  events: CalendarEvent[];
  handlers: ViewHandlers;
}) {
  const { rescheduleEvent, canEditEvent } = useStore();
  const weeks = useMemo(() => monthMatrix(date), [date]);
  const labels = useMemo(
    () => weekDays(new Date()).map((d) => format(d, "EEE")),
    [],
  );

  const [rowHeight, setRowHeight] = useState(0);
  const gridRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ id: string; overKey: string } | null>(null);
  // A drag ends with a click event on the pill; swallow that one click.
  const justDragged = useRef(false);

  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setRowHeight(el.clientHeight / weeks.length);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [weeks.length]);

  const maxLanes = Math.max(1, Math.floor((rowHeight - HEADER_H - 4) / LANE_H));

  /** Pointer-drag an event onto another day. */
  const startDrag = (e: React.PointerEvent, event: CalendarEvent) => {
    if (e.button !== 0 || !canEditEvent(event)) return;
    const originX = e.clientX;
    const originY = e.clientY;
    let moved = false;
    let target: Date | null = null;

    const dayUnder = (x: number, y: number) => {
      const el = document
        .elementsFromPoint(x, y)
        .find((n) => n instanceof HTMLElement && n.dataset.day) as
        | HTMLElement
        | undefined;
      return el?.dataset.day ? new Date(el.dataset.day) : null;
    };

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - originX, ev.clientY - originY) < 5) return;
      moved = true;
      target = dayUnder(ev.clientX, ev.clientY);
      setDrag({ id: event.id, overKey: target ? target.toDateString() : "" });
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);
      if (!moved || !target) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      const start = new Date(event.start);
      const end = new Date(event.end);
      const shift = differenceInCalendarDays(target, startOfDay(start));
      if (shift !== 0) {
        rescheduleEvent(event.id, addDays(start, shift), addDays(end, shift));
      }
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="grid shrink-0 grid-cols-7 border-b border-line">
        {labels.map((label) => (
          <div
            key={label}
            className="py-2 text-center text-[11px] font-semibold tracking-wider text-ink-faint uppercase"
          >
            {label}
          </div>
        ))}
      </div>

      <div ref={gridRef} className="flex min-h-0 flex-1 flex-col">
        {weeks.map((days, weekIndex) => {
          const { segments } = layoutWeek(events, days);
          const shown = segments.filter((s) => s.lane < maxLanes);
          const hidden = segments.filter((s) => s.lane >= maxLanes);

          return (
            <div
              key={weekIndex}
              className="relative grid min-h-0 flex-1 grid-cols-7"
            >
              {days.map((day) => {
                const inMonth = isSameMonth(day, date);
                const today = isToday(day);
                const overflow = hidden.filter(
                  (s) =>
                    day >= days[s.col] &&
                    day <= days[Math.min(6, s.col + s.span - 1)],
                ).length;

                return (
                  <div
                    key={day.toISOString()}
                    data-day={day.toISOString()}
                    onClick={() => {
                      const start = new Date(day);
                      start.setHours(9, 0, 0, 0);
                      handlers.onCreate(start, addHours(start, 1), false);
                    }}
                    onContextMenu={(e) => handlers.onSlotMenu(e, day, false)}
                    className={clsx(
                      "group relative min-w-0 border-r border-b border-line transition-colors last:border-r-0",
                      inMonth ? "bg-surface" : "bg-surface-2/60",
                      drag?.overKey === day.toDateString() && "bg-brand-soft",
                    )}
                  >
                    <div className="flex h-[26px] items-center justify-center pt-[3px]">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlers.onNavigate(day, "day");
                        }}
                        className={clsx(
                          "flex h-[22px] min-w-[22px] items-center justify-center rounded-full px-1.5 text-[12px] font-medium transition",
                          today
                            ? "bg-brand font-semibold text-white"
                            : inMonth
                              ? "text-ink-muted hover:bg-surface-2"
                              : "text-ink-faint hover:bg-surface",
                        )}
                      >
                        {day.getDate() === 1
                          ? format(day, "d MMM")
                          : day.getDate()}
                      </button>
                    </div>

                    {overflow > 0 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlers.onNavigate(day, "day");
                        }}
                        className="absolute right-1.5 bottom-1 left-1.5 truncate rounded px-1 text-left text-[11px] font-medium text-ink-muted hover:bg-surface-2 hover:text-brand"
                      >
                        +{overflow} more
                      </button>
                    )}
                  </div>
                );
              })}

              <div
                className="pointer-events-none absolute inset-x-0 bottom-0"
                style={{ top: HEADER_H }}
              >
                {shown.map((seg) => (
                  <div
                    key={seg.event.id}
                    className="pointer-events-auto absolute px-[3px]"
                    style={{
                      left: `${(seg.col / 7) * 100}%`,
                      width: `${(seg.span / 7) * 100}%`,
                      top: seg.lane * LANE_H,
                      opacity: drag?.id === seg.event.id ? 0.45 : 1,
                    }}
                  >
                    <EventPill
                      event={seg.event}
                      banner={seg.span > 1 || seg.event.allDay}
                      continuesLeft={seg.continuesLeft}
                      continuesRight={seg.continuesRight}
                      selected={handlers.selectedId === seg.event.id}
                      onDragStart={(e) => startDrag(e, seg.event)}
                      onOpen={(e) => {
                        e.stopPropagation();
                        if (justDragged.current || seg.event.masked) return;
                        handlers.onOpenEvent(seg.event);
                      }}
                      onMenu={(e) => handlers.onEventMenu(e, seg.event)}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
