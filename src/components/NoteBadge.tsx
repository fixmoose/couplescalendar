"use client";

import clsx from "clsx";
import { StickyNote } from "lucide-react";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";

/** How many notes are pinned to this event — as far as you may see them. */
export function NoteBadge({
  event,
  className,
}: {
  event: CalendarEvent;
  className?: string;
}) {
  const store = useStore();
  if (event.masked) return null;

  const count = store.notesFor(event.id).length;
  if (count === 0) return null;

  return (
    <span
      className={clsx("flex shrink-0 items-center gap-0.5 text-[10px] font-semibold", className)}
      title={`${count} note${count === 1 ? "" : "s"}`}
    >
      <StickyNote size={10} />
      {count > 1 && count}
    </span>
  );
}
