"use client";

import { Users, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar } from "./ui";

/**
 * The strip that appears while one group has the calendar to itself: what you
 * are looking at, and the way out. Deliberately loud — a filtered calendar
 * that looks like a normal one is how people conclude their events have
 * vanished.
 */
export function FocusBar({
  groupId,
  count,
  onClear,
}: {
  groupId: string;
  count: number;
  onClear: () => void;
}) {
  const store = useStore();
  const group = store.groups.find((g) => g.id === groupId);
  if (!group) return null;

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-brand/30 bg-brand-soft px-4 py-1.5 text-[12px] text-brand">
      <Users size={13} className="shrink-0" />
      <span>
        Showing <strong className="font-semibold">{group.name}</strong> only —{" "}
        {count} {count === 1 ? "event" : "events"}
      </span>

      <span className="flex -space-x-1.5 pl-1">
        {group.memberIds.slice(0, 5).map((id) => {
          const person = store.personById(id);
          return person ? (
            <Avatar
              key={id}
              person={person}
              size={18}
              className="ring-2 ring-[var(--cc-brand-soft)]"
            />
          ) : null;
        })}
      </span>

      <button
        type="button"
        onClick={onClear}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 font-medium hover:bg-brand/10"
      >
        <X size={12} /> Show everything
      </button>
    </div>
  );
}
