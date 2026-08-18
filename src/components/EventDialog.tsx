"use client";

import clsx from "clsx";
import { format } from "date-fns";
import { Check, CopyPlus, Paperclip, Trash2 } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { colorVar } from "@/lib/colors";
import { uploadAttachment } from "@/lib/db";
import { MAX_FILE_BYTES, formatBytes } from "@/lib/files";
import { useStore } from "@/lib/store";
import type { Attachment, CalendarEvent, EventDraft } from "@/lib/types";
import { AttachmentList } from "./Attachments";
import { PeopleStack, ProvenanceIcon, useEventPeople } from "./Participants";
import { useFileDrop } from "./useFileDrop";
import { PrivacyPicker } from "./PrivacyPicker";
import { LocationLink, SmartText } from "./SmartText";
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
  event,
  onClose,
}: {
  draft: EventDraft;
  /** Present when editing — carries sharing state the draft does not. */
  event?: CalendarEvent;
  onClose: () => void;
}) {
  const store = useStore();
  const [form, setForm] = useState<EventDraft>(draft);
  const isEdit = Boolean(draft.id);
  const editable = event ? store.canEditEvent(event) : true;

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

  if (event && !editable) {
    return <SharedEventView event={event} onClose={onClose} />;
  }

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
        {event && <ProvenanceBanner event={event} />}

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
            placeholder="Add an address or a link"
            className={inputClass}
          />
          {form.location.trim() && (
            <p className="mt-1.5 text-[12px]">
              <LocationLink location={form.location.trim()} />
            </p>
          )}
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

        <Field label="Files">
          <FileDropField
            attachments={form.attachments ?? []}
            onAdd={(added) =>
              set("attachments", [...(form.attachments ?? []), ...added])
            }
            onRemove={(id) =>
              set(
                "attachments",
                (form.attachments ?? []).filter((a) => a.id !== id),
              )
            }
            uploadedBy={store.currentUserId}
          />
        </Field>

        <Field label="Who else can see it">
          <PrivacyPicker
            value={form.privacy}
            onChange={(privacy) => set("privacy", privacy)}
            subject="this event"
            allowInherit
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
          <p className="mt-1.5 text-[12px] text-ink-faint">
            People you pick here always see the full event, whatever the
            privacy setting above says.
          </p>
        </Field>
      </div>
    </Modal>
  );
}

/** "Ana shared this with you", "Shared with Ana and Marko", and who is on it. */
function ProvenanceBanner({ event }: { event: CalendarEvent }) {
  const { provenance, others, label } = useEventPeople(event);
  if (provenance === "private") return null;

  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-surface-2 px-3 py-2">
      <ProvenanceIcon provenance={provenance} size={15} className="text-brand" />
      <span className="min-w-0 flex-1 text-[13px] text-ink-muted">{label}</span>
      <PeopleStack people={others} size={22} max={4} />
    </div>
  );
}

/** Someone else's event, shared with me: readable, not editable, copyable. */
function SharedEventView({
  event,
  onClose,
}: {
  event: CalendarEvent;
  onClose: () => void;
}) {
  const store = useStore();
  const calendar = store.calendarById(event.calendarId);
  const start = new Date(event.start);
  const end = new Date(event.end);

  const copyToMine = () => {
    const target =
      store.myCalendars.find((c) => c.visible) ?? store.myCalendars[0];
    if (!target) return;
    store.createEvent({
      calendarId: target.id,
      title: event.title,
      notes: event.notes ?? "",
      location: event.location ?? "",
      start,
      end,
      allDay: event.allDay,
      sharedWith: [],
    });
    onClose();
  };

  return (
    <Modal
      title="Shared with you"
      onClose={onClose}
      width={460}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" onClick={copyToMine}>
            <CopyPlus size={15} /> Copy to my calendar
          </Button>
        </>
      }
    >
      <div className="space-y-3.5">
        <ProvenanceBanner event={event} />

        <div>
          <div className="text-[17px] font-semibold text-ink">{event.title}</div>
          <div className="mt-0.5 text-[13px] text-ink-muted">
            {event.allDay
              ? format(start, "EEEE, d MMMM yyyy")
              : `${format(start, "EEEE, d MMMM")} · ${format(start, "HH:mm")} – ${format(end, "HH:mm")}`}
          </div>
        </div>

        {event.location && (
          <Field label="Location">
            <LocationLink location={event.location} className="text-[13px]" />
          </Field>
        )}
        {event.notes && (
          <Field label="Notes">
            <SmartText
              text={event.notes}
              className="text-[13px] whitespace-pre-wrap text-ink"
            />
          </Field>
        )}
        {event.attachments && event.attachments.length > 0 && (
          <Field label="Files">
            <AttachmentList attachments={event.attachments} />
          </Field>
        )}
        <Field label="Calendar">
          <p className="text-[13px] text-ink">
            {calendar?.name}
            {calendar?.kind === "personal" &&
              ` · ${store.personById(calendar.ownerId)?.name ?? "someone"}'s calendar`}
          </p>
        </Field>
        <p className="text-[12px] text-ink-faint">
          Only the owner can change this event. Copy it to keep your own version.
        </p>
      </div>
    </Modal>
  );
}


/** Drop zone plus a file picker, used inside the event editor. */
function FileDropField({
  attachments,
  uploadedBy,
  onAdd,
  onRemove,
}: {
  attachments: Attachment[];
  uploadedBy: string;
  onAdd: (attachments: Attachment[]) => void;
  onRemove: (id: string) => void;
}) {
  const { supabase } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const take = async (files: File[]) => {
    if (!files.length) return;
    setBusy(true);
    setError(null);
    const stored: Attachment[] = [];
    const failed: string[] = [];
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        failed.push(`${file.name} (over ${formatBytes(MAX_FILE_BYTES)})`);
        continue;
      }
      try {
        stored.push(await uploadAttachment(supabase, file, uploadedBy));
      } catch {
        failed.push(file.name);
      }
    }
    setBusy(false);
    if (failed.length) setError(`Could not attach: ${failed.join(", ")}`);
    if (stored.length) onAdd(stored);
  };

  const { over, handlers } = useFileDrop((files) => void take(files));

  return (
    <div className="space-y-2">
      <AttachmentList attachments={attachments} onRemove={onRemove} />

      <button
        type="button"
        onClick={() => input.current?.click()}
        {...handlers}
        className={clsx(
          "flex w-full items-center justify-center gap-2 rounded-lg border border-dashed px-3 py-3 text-[13px] transition",
          over
            ? "border-brand bg-brand-soft text-brand"
            : "border-line text-ink-faint hover:border-brand/50 hover:text-ink",
        )}
      >
        <Paperclip size={14} />
        {busy ? "Adding…" : "Drop files here, or click to choose"}
      </button>

      {error && <p className="text-[12px] text-[#d1443c]">{error}</p>}

      <input
        ref={input}
        type="file"
        multiple
        hidden
        onChange={(e) => {
          void take([...(e.target.files ?? [])]);
          e.target.value = "";
        }}
      />
    </div>
  );
}