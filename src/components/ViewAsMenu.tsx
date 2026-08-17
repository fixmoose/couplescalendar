"use client";

import clsx from "clsx";
import { Eye, RotateCcw } from "lucide-react";
import { useState } from "react";
import { ME } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import { Avatar } from "./ui";

/**
 * Phase 1 has no login, so this is how you check the privacy rules: look at
 * the same calendar as someone else and see exactly what they get. It goes
 * away once Supabase auth lands.
 */
export function ViewAsMenu() {
  const store = useStore();
  const [menu, setMenu] = useState<MenuState | null>(null);

  const open = (e: React.MouseEvent) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const owner = store.personById(ME);
    const items: MenuItem[] = [
      { kind: "heading", label: "Preview the calendar as" },
      ...store.people.map((person) => ({
        label: person.id === ME ? `${person.name} (you)` : person.name,
        icon: <Avatar person={person} size={16} />,
        checked: person.id === store.currentUserId,
        onSelect: () => store.viewAs(person.id),
      })),
    ];
    if (store.previewing && owner) {
      items.push(
        { kind: "separator" },
        {
          label: `Back to ${owner.name}`,
          icon: <RotateCcw size={13} />,
          onSelect: () => store.viewAs(ME),
        },
      );
    }
    setMenu({ x: rect.right - 220, y: rect.bottom + 6, items });
  };

  return (
    <>
      <button
        type="button"
        onClick={open}
        aria-label="Preview as another person"
        className={clsx(
          "flex items-center gap-1.5 rounded-full p-0.5 transition hover:bg-surface-2",
          store.previewing && "ring-2 ring-brand",
        )}
      >
        <Avatar person={store.me} size={28} />
        {store.previewing && (
          <span className="flex items-center gap-1 pr-1.5 text-[11px] font-semibold text-brand">
            <Eye size={12} /> preview
          </span>
        )}
      </button>
      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}
    </>
  );
}

/** Reminder bar shown while previewing, so nobody edits as the wrong person. */
export function PreviewBanner() {
  const store = useStore();
  if (!store.previewing) return null;
  const owner = store.personById(ME);

  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-brand/30 bg-brand-soft px-4 py-1.5 text-[12px] text-brand">
      <Eye size={13} />
      <span>
        Previewing as <strong className="font-semibold">{store.me.name}</strong> —
        this is exactly what they can see of your calendar.
      </span>
      <button
        type="button"
        onClick={() => store.viewAs(ME)}
        className="ml-auto flex items-center gap-1 rounded-md px-2 py-0.5 font-medium hover:bg-brand/10"
      >
        <RotateCcw size={12} /> Back to {owner?.name ?? "me"}
      </button>
    </div>
  );
}
