"use client";

import clsx from "clsx";
import {
  addMonths,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { monthMatrix, occursOn, weekDays } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";
import { IconButton } from "./ui";

export function MiniMonth({
  selected,
  events,
  onSelect,
}: {
  selected: Date;
  events: CalendarEvent[];
  onSelect: (date: Date) => void;
}) {
  const [cursor, setCursor] = useState(() => startOfMonth(selected));
  const [syncedTo, setSyncedTo] = useState(selected);

  // Follow the main view when it jumps to another month, while still allowing
  // the arrows below to browse ahead on their own.
  if (selected !== syncedTo) {
    setSyncedTo(selected);
    setCursor(startOfMonth(selected));
  }

  const weeks = useMemo(() => monthMatrix(cursor), [cursor]);
  const labels = useMemo(
    () => weekDays(new Date()).map((d) => format(d, "EEEEE")),
    [],
  );
  const busy = useMemo(() => {
    const set = new Set<string>();
    for (const day of weeks.flat()) {
      if (events.some((e) => occursOn(e, day))) set.add(day.toDateString());
    }
    return set;
  }, [weeks, events]);

  return (
    <div className="px-1">
      <div className="mb-1 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink">
          {format(cursor, "MMMM yyyy")}
        </div>
        <div className="flex">
          <IconButton
            className="h-6 w-6"
            onClick={() => setCursor(addMonths(cursor, -1))}
            aria-label="Previous month"
          >
            <ChevronLeft size={14} />
          </IconButton>
          <IconButton
            className="h-6 w-6"
            onClick={() => setCursor(addMonths(cursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight size={14} />
          </IconButton>
        </div>
      </div>

      <div className="grid grid-cols-7">
        {labels.map((l, i) => (
          <div
            key={i}
            className="pb-1 text-center text-[10px] font-medium text-ink-faint"
          >
            {l}
          </div>
        ))}
        {weeks.flat().map((day) => {
          const isSelected = isSameDay(day, selected);
          const today = isToday(day);
          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => onSelect(day)}
              className={clsx(
                "relative flex h-7 items-center justify-center rounded-md text-[12px] transition",
                !isSameMonth(day, cursor) && "text-ink-faint",
                isSameMonth(day, cursor) && !isSelected && "text-ink-muted",
                isSelected && "bg-brand font-semibold text-white",
                !isSelected && today && "font-semibold text-brand",
                !isSelected && "hover:bg-surface-2",
              )}
            >
              {day.getDate()}
              {busy.has(day.toDateString()) && !isSelected && (
                <span className="absolute bottom-[3px] h-[3px] w-[3px] rounded-full bg-brand/70" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
