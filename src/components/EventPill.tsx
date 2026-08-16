"use client";

import clsx from "clsx";
import { Users } from "lucide-react";
import { colorVar } from "@/lib/colors";
import { timeLabel } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent, ColorKey } from "@/lib/types";

export function useEventColor(event: CalendarEvent): ColorKey {
  const { calendarById } = useStore();
  return event.color ?? calendarById(event.calendarId)?.color ?? "slate";
}

/**
 * The compact representation used in month cells and the all-day strip.
 * `banner` events get a solid bar; timed events stay light so a dense day
 * still reads as a list rather than a block of colour.
 */
export function EventPill({
  event,
  banner,
  continuesLeft,
  continuesRight,
  selected,
  onOpen,
  onMenu,
  onDragStart,
}: {
  event: CalendarEvent;
  banner: boolean;
  continuesLeft?: boolean;
  continuesRight?: boolean;
  selected?: boolean;
  onOpen: (e: React.MouseEvent) => void;
  onMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.PointerEvent) => void;
}) {
  const color = useEventColor(event);
  const start = new Date(event.start);

  return (
    <div
      role="button"
      tabIndex={0}
      style={colorVar(color)}
      onPointerDown={onDragStart}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen(e as unknown as React.MouseEvent);
        }
      }}
      onContextMenu={onMenu}
      title={event.title}
      className={clsx(
        "flex h-[21px] w-full items-center gap-1.5 overflow-hidden px-1.5 text-[12px] leading-none transition select-none",
        banner
          ? "cc-solid font-medium"
          : "font-medium text-ink hover:bg-surface-2",
        continuesLeft ? "rounded-l-none" : "rounded-l-[5px]",
        continuesRight ? "rounded-r-none" : "rounded-r-[5px]",
        selected && "ring-2 ring-[var(--c)] ring-offset-1 ring-offset-[var(--surface)]",
      )}
    >
      {!banner && (
        <span className="cc-dot h-[7px] w-[7px] shrink-0 rounded-full" />
      )}
      {continuesLeft && <span className="shrink-0 opacity-80">‹</span>}
      <span className="truncate">
        {!banner && (
          <span className="mr-1 text-ink-muted tabular-nums">
            {timeLabel(start)}
          </span>
        )}
        {event.title}
      </span>
      {event.sharedWith.length > 0 && (
        <Users
          size={10}
          className={clsx("ml-auto shrink-0", banner ? "opacity-90" : "text-ink-faint")}
        />
      )}
      {continuesRight && <span className="ml-auto shrink-0 opacity-80">›</span>}
    </div>
  );
}
