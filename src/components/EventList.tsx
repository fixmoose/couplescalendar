"use client";

import clsx from "clsx";
import { Backpack, Check, ListTodo, Plus, ShoppingCart, X } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { CalendarEvent, ListKind } from "@/lib/types";
import { Avatar, controlClass } from "./ui";

export const LIST_KINDS: {
  kind: ListKind;
  label: string;
  icon: typeof ListTodo;
  /** Wording for what is left — "3 to buy" beats "3 to do" at the shops. */
  outstanding: (n: number) => string;
}[] = [
  { kind: "todo", label: "To-do", icon: ListTodo, outstanding: (n) => `${n} to do` },
  {
    kind: "shopping",
    label: "Shopping",
    icon: ShoppingCart,
    outstanding: (n) => `${n} to buy`,
  },
  { kind: "packing", label: "Packing", icon: Backpack, outstanding: (n) => `${n} to pack` },
];

export const listMeta = (kind: ListKind = "todo") =>
  LIST_KINDS.find((k) => k.kind === kind) ?? LIST_KINDS[0];

export function listProgress(event: CalendarEvent) {
  const items = event.items ?? [];
  const done = items.filter((i) => i.done).length;
  return { done, total: items.length, left: items.length - done };
}

/**
 * The list attached to an event. Anyone who can see the event can work it —
 * whoever is at the shop ticks things off, which is the point of sharing one.
 */
export function EventList({
  event,
  compact = false,
}: {
  event: CalendarEvent;
  compact?: boolean;
}) {
  const store = useStore();
  const [text, setText] = useState("");
  const [quantity, setQuantity] = useState("");
  const meta = listMeta(event.listKind);
  const items = [...(event.items ?? [])].sort((a, b) => a.position - b.position);
  const { done, total } = listProgress(event);
  const isShopping = event.listKind === "shopping";

  const people = [store.me, ...store.participantsOf(event)].filter(
    (p, i, all) => all.findIndex((x) => x.id === p.id) === i,
  );

  const add = () => {
    const value = text.trim();
    if (!value) return;
    store.addItem(event.id, {
      text: value,
      quantity: quantity.trim() || undefined,
    });
    setText("");
    setQuantity("");
  };

  return (
    <div className="space-y-2">
      {!compact && (
        <div className="flex items-center gap-1.5">
          {LIST_KINDS.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              onClick={() => store.setListKind(event.id, kind)}
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition",
                (event.listKind ?? "todo") === kind
                  ? "border-brand/50 bg-brand-soft font-medium text-brand"
                  : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
          {total > 0 && (
            <span className="ml-auto text-[12px] text-ink-faint tabular-nums">
              {done}/{total} done
            </span>
          )}
        </div>
      )}

      <div className="space-y-1">
        {items.map((item) => {
          const assignee = item.assignedTo ? store.personById(item.assignedTo) : undefined;
          return (
            <div
              key={item.id}
              className="group flex items-center gap-2 rounded-lg px-1 py-1 transition hover:bg-surface-2"
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={item.done}
                onClick={() =>
                  store.updateItem(event.id, item.id, { done: !item.done })
                }
                className={clsx(
                  "flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-2 transition",
                  item.done
                    ? "border-brand bg-brand text-white"
                    : "border-line-strong hover:border-brand",
                )}
              >
                {item.done && <Check size={11} strokeWidth={3.5} />}
              </button>

              {item.quantity && (
                <span
                  className={clsx(
                    "shrink-0 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
                    item.done ? "text-ink-faint" : "text-ink-muted",
                  )}
                >
                  {item.quantity}
                </span>
              )}

              <span
                className={clsx(
                  "min-w-0 flex-1 truncate text-[13px]",
                  item.done ? "text-ink-faint line-through" : "text-ink",
                )}
              >
                {item.text}
              </span>

              {/* Who is bringing it. Clicking cycles through the people on the event. */}
              <button
                type="button"
                title={assignee ? `${assignee.name} — click to change` : "Assign to someone"}
                onClick={() => {
                  const index = people.findIndex((p) => p.id === item.assignedTo);
                  const next = people[index + 1];
                  store.updateItem(event.id, item.id, {
                    assignedTo: index === people.length - 1 ? undefined : (next ?? people[0]).id,
                  });
                }}
                className="shrink-0"
              >
                {assignee ? (
                  <Avatar person={assignee} size={20} />
                ) : (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-dashed border-line text-ink-faint opacity-0 transition group-hover:opacity-100">
                    <Plus size={11} />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => store.removeItem(event.id, item.id)}
                title="Remove"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-faint opacity-0 transition group-hover:opacity-100 hover:text-[#d1443c]"
              >
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex gap-1.5">
        {isShopping && (
          <input
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && add()}
            placeholder="2 ×"
            className={`${controlClass} w-[64px] py-1.5 text-[13px]`}
          />
        )}
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder={
            isShopping ? "Add something to buy" : `Add something to ${meta.label.toLowerCase()}`
          }
          className={`${controlClass} min-w-0 flex-1 py-1.5 text-[13px]`}
        />
        <button
          type="button"
          onClick={add}
          disabled={!text.trim()}
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border border-line text-ink-muted transition hover:border-brand/50 hover:text-brand disabled:opacity-40"
        >
          <Plus size={15} />
        </button>
      </div>
    </div>
  );
}

/** The chip in the grid: how much of the list is left. */
export function ListBadge({
  event,
  className,
}: {
  event: CalendarEvent;
  className?: string;
}) {
  const { done, total } = listProgress(event);
  if (total === 0) return null;
  const Icon = listMeta(event.listKind).icon;
  const complete = done === total;

  return (
    <span
      className={clsx(
        "flex shrink-0 items-center gap-0.5 text-[10px] font-semibold tabular-nums",
        complete && "opacity-60",
        className,
      )}
      title={`${done} of ${total} done`}
    >
      <Icon size={10} />
      {done}/{total}
    </span>
  );
}
