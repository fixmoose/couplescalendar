"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { Check, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { colorVar } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { EventDraft } from "@/lib/types";
import { Avatar, Button, Field, Modal, controlClass, inputClass } from "./ui";

const dateValue = (d: Date) => format(d, "yyyy-MM-dd");
const timeValue = (d: Date) => format(d, "HH:mm");

function withDate(base: Date, value: string) {
  const [y, m, d] = value.split("-").map(Number);
  const next = new Date(base);
  next.setFullYear(y, m - 1, d);
  return next;
}

function withTime(base: Date, value: string) {
  const [h, min] = value.split(":").map(Number);
  const next = new Date(base);
  next.setHours(h, min, 0, 0);
  return next;
}

export function EventDialog({
  draft,
  onClose,
}: {
  draft: EventDraft;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<EventDraft>(draft);
  const isEdit = Boolean(draft.id);

  const set = <K extends keyof EventDraft>(key: K, value: EventDraft[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  /** Everyone I share a group with — the people I can push an event to. */
  const contacts = useMemo(() => {
    const ids = new Set(
      store.groups
        .filter((g) => g.memberIds.includes(store.currentUserId))
        .flatMap((g) => g.memberIds),
    );
    ids.delete(store.currentUserId);
    return [...ids].map((id) => store.personById(id)).filter((p) => p !== undefined);
  }, [store]);

  const save = () => {
    let { start, end } = form;
    if (form.allDay) {
      start = new Date(start);
      start.setHours(0, 0, 0, 0);
      end = new Date(end);
      end.setHours(23, 59, 59, 999);
    } else if (end <= start) {
      end = new Date(start.getTime() + 30 * 60_000);
    }
    const next = { ...form, start, end };
    if (next.id) store.updateEvent({ ...next, id: next.id });
    else store.createEvent(next);
    onClose();
  };

  return (
    <Modal
      title={isEdit ? "Edit event" : "New event"}
      onClose={onClose}
      width={480}
      footer={
        <>
          {isEdit && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                store.deleteEvent(form.id!);
                onClose();
              }}
            >
              <Trash2 size={15} /> Delete
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
          }}
          placeholder="Add a title"
          className={`${inputClass} text-[16px] font-medium`}
        />

        <div className="flex items-center gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-muted">
            <input
              type="checkbox"
              checked={form.allDay}
              onChange={(e) => set("allDay", e.target.checked)}
              className="h-4 w-4 accent-[var(--cc-brand)]"
            />
            All day
          </label>
        </div>

        <Field label="Starts">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateValue(form.start)}
              onChange={(e) => set("start", withDate(form.start, e.target.value))}
              className={`${controlClass} min-w-0 flex-1`}
            />
            {!form.allDay && (
              <input
                type="time"
                value={timeValue(form.start)}
                onChange={(e) => set("start", withTime(form.start, e.target.value))}
                className={`${controlClass} w-[132px] shrink-0`}
              />
            )}
          </div>
        </Field>

        <Field label="Ends">
          <div className="flex gap-2">
            <input
              type="date"
              value={dateValue(form.end)}
              onChange={(e) => set("end", withDate(form.end, e.target.value))}
              className={`${controlClass} min-w-0 flex-1`}
            />
            {!form.allDay && (
              <input
                type="time"
                value={timeValue(form.end)}
                onChange={(e) => set("end", withTime(form.end, e.target.value))}
                className={`${controlClass} w-[132px] shrink-0`}
              />
            )}
          </div>
        </Field>

        <Field label="Calendar">
          <select
            value={form.calendarId}
            onChange={(e) => set("calendarId", e.target.value)}
            className={inputClass}
          >
            {store.calendars.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.kind === "shared" ? " · shared" : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Location">
          <input
            value={form.location}
            onChange={(e) => set("location", e.target.value)}
            placeholder="Add a place or a link"
            className={inputClass}
          />
        </Field>

        <Field label="Notes">
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            placeholder="Details for this event"
            className={`${inputClass} resize-none`}
          />
        </Field>

        <Field label="Also on their calendar">
          <div className="flex flex-wrap gap-1.5">
            {contacts.length === 0 && (
              <p className="text-[12px] text-ink-faint">
                Add people to a group first.
              </p>
            )}
            {contacts.map((person) => {
              const on = form.sharedWith.includes(person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() =>
                    set(
                      "sharedWith",
                      on
                        ? form.sharedWith.filter((id) => id !== person.id)
                        : [...form.sharedWith, person.id],
                    )
                  }
                  style={colorVar(person.avatarColor)}
                  className={clsx(
                    "flex items-center gap-1.5 rounded-full border py-1 pr-2.5 pl-1 text-[13px] transition",
                    on
                      ? "cc-tint cc-tint-border font-medium"
                      : "border-line text-ink-muted hover:bg-surface-2",
                  )}
                >
                  <Avatar person={person} size={20} />
                  {person.name}
                  {on && <Check size={13} />}
                </button>
              );
            })}
          </div>
        </Field>
      </div>
    </Modal>
  );
}
