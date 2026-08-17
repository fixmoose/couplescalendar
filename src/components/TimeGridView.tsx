"use client";

import clsx from "clsx";
import { addMinutes, format, isSameDay, isToday, startOfDay } from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { colorVar } from "@/lib/colors";
import {
  isBanner,
  layoutDay,
  layoutWeek,
  MINUTES_PER_DAY,
  minutesFromMidnight,
  timeLabel,
} from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { EventPill, useEventColor } from "./EventPill";
import { PeopleStack, ProvenanceIcon, useEventPeople } from "./Participants";
import { Avatar } from "./ui";
import type { ViewHandlers } from "./view-types";

/** Width of the "someone else is busy" lane, as a fraction of a day column. */
const BUSY_LANE = 0.24;
const BUSY_LANE_START = 1 - BUSY_LANE;

const HOUR_H = 48;
const DAY_H = HOUR_H * 24;
const SNAP = 15;
const GUTTER = "64px";

type Drag =
  | { mode: "create"; dayIndex: number; anchor: number; from: number; to: number }
  | { mode: "move"; event: CalendarEvent; dayIndex: number; from: number; to: number; grab: number }
  | { mode: "resize"; event: CalendarEvent; dayIndex: number; from: number; to: number };

function snap(minutes: number) {
  return Math.round(minutes / SNAP) * SNAP;
}

function clampDay(minutes: number) {
  return Math.max(0, Math.min(MINUTES_PER_DAY, minutes));
}

function Block({
  event,
  style,
  selected,
  compact,
  editable,
  onOpen,
  onMenu,
  onMove,
  onResize,
}: {
  event: CalendarEvent;
  style: React.CSSProperties;
  selected: boolean;
  compact: boolean;
  editable: boolean;
  onOpen: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
  onMove: (e: React.PointerEvent) => void;
  onResize: (e: React.PointerEvent) => void;
}) {
  const color = useEventColor(event);
  const { provenance, others, label } = useEventPeople(event);
  const start = new Date(event.start);
  const end = new Date(event.end);
  const masked = Boolean(event.masked);

  return (
    <div
      style={{ ...style, ...colorVar(color) }}
      onPointerDown={editable ? onMove : undefined}
      onClick={onOpen}
      onContextMenu={onMenu}
      title={masked ? label : `${event.title} — ${label}`}
      className={clsx(
        "group absolute overflow-hidden rounded-[7px] border px-2 py-1 text-[12px] transition select-none",
        masked
          ? "cc-busy border-dashed"
          : "cc-tint cc-tint-border cc-rail hover:z-20 hover:shadow-[var(--shadow-sm)]",
        selected && "z-20 ring-2 ring-[var(--c)]",
      )}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={clsx(
            "min-w-0 flex-1 truncate font-semibold",
            compact && "text-[11px] leading-tight",
            masked && "italic",
          )}
        >
          {event.title}
        </div>
        {provenance !== "private" && (
          <ProvenanceIcon provenance={provenance} className="opacity-70" />
        )}
      </div>

      {!compact && (
        <div className="truncate text-[11px] opacity-80 tabular-nums">
          {timeLabel(start)} – {timeLabel(end)}
          {event.location ? ` · ${event.location}` : ""}
        </div>
      )}

      {!compact && others.length > 0 && (
        <PeopleStack people={others} size={16} max={4} className="mt-1" />
      )}

      {editable && (
        <div
          onPointerDown={onResize}
          className="absolute inset-x-0 -bottom-px h-2 cursor-ns-resize opacity-0 group-hover:opacity-100"
        >
          <div className="mx-auto mt-1 h-[3px] w-6 rounded-full bg-[var(--c)]" />
        </div>
      )}
    </div>
  );
}

/** Someone else's time: no title, no interaction beyond "hide their busy times". */
function BusyBlock({
  event,
  style,
  height,
  narrow,
  onMenu,
}: {
  event: CalendarEvent;
  style: React.CSSProperties;
  /** Rendered height in px — short blocks show the hatch alone. */
  height: number;
  narrow: boolean;
  onMenu: (e: React.MouseEvent) => void;
}) {
  const { others, label } = useEventPeople(event);
  const person = others[0];

  return (
    <div
      style={style}
      title={label}
      onContextMenu={onMenu}
      className="cc-busy absolute z-0 flex flex-col items-center justify-center gap-1 overflow-hidden rounded-[6px] border border-dashed px-1 py-0.5 text-[11px] select-none"
    >
      {person && height >= 26 && <Avatar person={person} size={16} />}
      {!narrow && height >= 44 && (
        <span className="truncate font-medium italic">
          {person ? `${person.name} is busy` : "Busy"}
        </span>
      )}
    </div>
  );
}

export function TimeGridView({
  days,
  events,
  handlers,
}: {
  days: Date[];
  events: CalendarEvent[];
  handlers: ViewHandlers;
}) {
  const { rescheduleEvent, canEditEvent } = useStore();
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const justDragged = useRef(false);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Open on the working day rather than at midnight.
  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 7 * HOUR_H - 8;
  }, []);

  const banners = useMemo(
    () => layoutWeek(events.filter(isBanner), days),
    [events, days],
  );
  /**
   * Other people's busy blocks live in their own lane down the right of the
   * column. Mixing them into the same overlap layout would shrink your real
   * events every time someone else is booked, which makes your own day harder
   * to read for information you cannot act on anyway.
   */
  const columns = useMemo(() => {
    const mine = events.filter((e) => !e.masked);
    const theirs = events.filter((e) => e.masked);
    return days.map((day) => ({
      mine: layoutDay(mine, day),
      theirs: layoutDay(theirs, day),
    }));
  }, [days, events]);

  const pointToTime = (clientX: number, clientY: number) => {
    const rect = gridRef.current!.getBoundingClientRect();
    const colWidth = rect.width / days.length;
    const dayIndex = Math.max(
      0,
      Math.min(days.length - 1, Math.floor((clientX - rect.left) / colWidth)),
    );
    const minutes = clampDay(((clientY - rect.top) / DAY_H) * MINUTES_PER_DAY);
    return { dayIndex, minutes };
  };

  const at = (dayIndex: number, minutes: number) =>
    addMinutes(startOfDay(days[dayIndex]), clampDay(minutes));

  const beginDrag = (e: React.PointerEvent, initial: Drag) => {
    if (e.button !== 0) return;
    const originX = e.clientX;
    const originY = e.clientY;
    let moved = false;
    let current = initial;
    setDrag(current);

    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - originX, ev.clientY - originY) < 5) return;
      moved = true;
      const { dayIndex, minutes } = pointToTime(ev.clientX, ev.clientY);

      if (current.mode === "create") {
        const point = snap(minutes);
        current = {
          ...current,
          from: Math.min(current.anchor, point),
          to: Math.max(current.anchor + SNAP, point),
        };
      } else if (current.mode === "move") {
        const length = current.to - current.from;
        const from = clampDay(snap(minutes - current.grab));
        current = {
          ...current,
          dayIndex,
          from,
          to: Math.min(MINUTES_PER_DAY, from + length),
        };
      } else {
        current = {
          ...current,
          to: Math.max(current.from + SNAP, snap(minutes)),
        };
      }
      setDrag(current);
    };

    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      setDrag(null);

      if (current.mode === "create") {
        if (!moved) return; // a plain click is handled by onClick
        justDragged.current = true;
        window.setTimeout(() => (justDragged.current = false), 0);
        handlers.onCreate(
          at(current.dayIndex, current.from),
          at(current.dayIndex, current.to),
          false,
        );
        return;
      }

      if (!moved) return;
      justDragged.current = true;
      window.setTimeout(() => (justDragged.current = false), 0);
      rescheduleEvent(
        current.event.id,
        at(current.dayIndex, current.from),
        at(current.dayIndex, current.to),
      );
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  /** How much of a column your own events may use on a given day. */
  const lane = (dayIndex: number) =>
    columns[dayIndex].theirs.length > 0 ? BUSY_LANE_START : 1;

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const nowMinutes = minutesFromMidnight(now);
  const single = days.length === 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      {/* Day headers + all-day strip */}
      <div className="shrink-0 border-b border-line">
        <div
          className="grid"
          style={{ gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div />
          {days.map((day) => (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => handlers.onNavigate(day, "day")}
              className="flex items-center justify-center gap-1.5 border-l border-line py-2 transition hover:bg-surface-2"
            >
              <span
                className={clsx(
                  "text-[11px] font-semibold tracking-wider uppercase",
                  isToday(day) ? "text-brand" : "text-ink-faint",
                )}
              >
                {format(day, single ? "EEEE" : "EEE")}
              </span>
              <span
                className={clsx(
                  "flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[14px] font-semibold",
                  isToday(day) ? "bg-brand text-white" : "text-ink",
                )}
              >
                {day.getDate()}
              </span>
            </button>
          ))}
        </div>

        <div
          className="grid"
          style={{ gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0,1fr))` }}
        >
          <div className="flex items-start justify-end pt-1.5 pr-2 text-[10px] font-medium tracking-wide text-ink-faint uppercase">
            All day
          </div>
          <div
            className="relative min-h-[30px] py-1"
            style={{
              gridColumn: "2 / -1",
              height: Math.max(30, banners.laneCount * 23 + 8),
            }}
          >
            <div
              className="absolute inset-0 grid"
              style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))` }}
            >
              {days.map((day) => (
                <div
                  key={day.toISOString()}
                  onClick={() => {
                    const s = startOfDay(day);
                    const e = new Date(s);
                    e.setHours(23, 59, 59, 999);
                    handlers.onCreate(s, e, true);
                  }}
                  onContextMenu={(e) => handlers.onSlotMenu(e, day, true)}
                  className={clsx(
                    "border-l border-line transition-colors hover:bg-surface-2",
                    isToday(day) && !single && "bg-brand-soft/40",
                  )}
                />
              ))}
            </div>
            {banners.segments.map((seg) => (
              <div
                key={seg.event.id}
                className="absolute px-[3px]"
                style={{
                  left: `${(seg.col / days.length) * 100}%`,
                  width: `${(seg.span / days.length) * 100}%`,
                  top: 4 + seg.lane * 23,
                }}
              >
                <EventPill
                  event={seg.event}
                  banner
                  continuesLeft={seg.continuesLeft}
                  continuesRight={seg.continuesRight}
                  selected={handlers.selectedId === seg.event.id}
                  onOpen={(e) => {
                    e.stopPropagation();
                    if (seg.event.masked) return;
                    handlers.onOpenEvent(seg.event);
                  }}
                  onMenu={(e) => handlers.onEventMenu(e, seg.event)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable time grid */}
      <div ref={scrollRef} className="cc-scroll min-h-0 flex-1 overflow-y-auto">
        <div
          className="relative grid"
          style={{
            gridTemplateColumns: `${GUTTER} repeat(${days.length}, minmax(0,1fr))`,
            height: DAY_H,
          }}
        >
          {/* Hour labels */}
          <div className="relative">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[11px] font-medium text-ink-faint tabular-nums"
                style={{ top: h * HOUR_H }}
              >
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {/* Columns */}
          <div
            ref={gridRef}
            className="relative grid select-none"
            style={{
              gridColumn: "2 / -1",
              gridTemplateColumns: `repeat(${days.length}, minmax(0,1fr))`,
            }}
          >
            {days.map((day, dayIndex) => (
              <div
                key={day.toISOString()}
                className={clsx(
                  "relative border-l border-line",
                  isToday(day) && !single && "bg-brand-soft/25",
                )}
                onPointerDown={(e) => {
                  const { minutes } = pointToTime(e.clientX, e.clientY);
                  const anchor = snap(minutes);
                  beginDrag(e, {
                    mode: "create",
                    dayIndex,
                    anchor,
                    from: anchor,
                    to: anchor + 60,
                  });
                }}
                onClick={(e) => {
                  if (justDragged.current) return;
                  const { minutes } = pointToTime(e.clientX, e.clientY);
                  const from = snap(minutes);
                  handlers.onCreate(at(dayIndex, from), at(dayIndex, from + 60), false);
                }}
                onContextMenu={(e) => {
                  const { minutes } = pointToTime(e.clientX, e.clientY);
                  handlers.onSlotMenu(e, at(dayIndex, snap(minutes)), false);
                }}
              >
                {hours.map((h) => (
                  <div
                    key={h}
                    className="pointer-events-none absolute inset-x-0 border-t border-line"
                    style={{ top: h * HOUR_H }}
                  >
                    <div
                      className="absolute inset-x-0 border-t border-dashed border-line/60"
                      style={{ top: HOUR_H / 2 }}
                    />
                  </div>
                ))}

                {columns[dayIndex].theirs.map((p) => (
                  <BusyBlock
                    key={p.event.id}
                    event={p.event}
                    narrow={!single}
                    height={Math.max(16, p.height * DAY_H - 2)}
                    onMenu={(e) => handlers.onEventMenu(e, p.event)}
                    style={{
                      top: p.top * DAY_H,
                      height: Math.max(16, p.height * DAY_H - 2),
                      left: `calc(${(BUSY_LANE_START + p.left * BUSY_LANE) * 100}% + 2px)`,
                      width: `calc(${p.width * BUSY_LANE * 100}% - 4px)`,
                    }}
                  />
                ))}

                {columns[dayIndex].mine.map((p) => (
                  <Block
                    key={p.event.id}
                    event={p.event}
                    selected={handlers.selectedId === p.event.id}
                    compact={p.height * DAY_H < 44}
                    editable={canEditEvent(p.event)}
                    style={{
                      top: p.top * DAY_H,
                      height: Math.max(18, p.height * DAY_H - 2),
                      left: `calc(${p.left * lane(dayIndex) * 100}% + 3px)`,
                      width: `calc(${p.width * lane(dayIndex) * 100}% - 6px)`,
                      opacity: drag && "event" in drag && drag.event.id === p.event.id ? 0.35 : 1,
                    }}
                    onOpen={(e) => {
                      e.stopPropagation();
                      if (justDragged.current || p.event.masked) return;
                      handlers.onOpenEvent(p.event);
                    }}
                    onMenu={(e) => handlers.onEventMenu(e, p.event)}
                    onMove={(e) => {
                      e.stopPropagation();
                      const { minutes } = pointToTime(e.clientX, e.clientY);
                      const from = minutesFromMidnight(new Date(p.event.start));
                      const to = from + Math.round(p.height * MINUTES_PER_DAY);
                      beginDrag(e, {
                        mode: "move",
                        event: p.event,
                        dayIndex,
                        from,
                        to,
                        grab: minutes - from,
                      });
                    }}
                    onResize={(e) => {
                      e.stopPropagation();
                      const from = minutesFromMidnight(new Date(p.event.start));
                      beginDrag(e, {
                        mode: "resize",
                        event: p.event,
                        dayIndex,
                        from,
                        to: from + Math.round(p.height * MINUTES_PER_DAY),
                      });
                    }}
                  />
                ))}

                {/* Live drag preview */}
                {drag && drag.dayIndex === dayIndex && (
                  <div
                    className="pointer-events-none absolute right-[3px] left-[3px] z-30 rounded-[7px] border-2 border-brand bg-brand/15 px-2 py-1 text-[11px] font-semibold text-brand"
                    style={{
                      top: (drag.from / MINUTES_PER_DAY) * DAY_H,
                      height: Math.max(18, ((drag.to - drag.from) / MINUTES_PER_DAY) * DAY_H),
                    }}
                  >
                    {timeLabel(at(dayIndex, drag.from))} – {timeLabel(at(dayIndex, drag.to))}
                  </div>
                )}

                {isSameDay(day, now) && (
                  <div
                    className="pointer-events-none absolute inset-x-0 z-10"
                    style={{ top: (nowMinutes / MINUTES_PER_DAY) * DAY_H }}
                  >
                    <div className="relative h-px bg-[#e0443c]">
                      <span className="absolute -top-[3.5px] -left-[3px] h-[7px] w-[7px] rounded-full bg-[#e0443c]" />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
