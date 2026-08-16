"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Calendar, ColorKey } from "@/lib/types";
import { Button, ColorPicker, Field, Modal, inputClass } from "./ui";

export function CalendarDialog({
  calendar,
  defaultGroupId,
  onClose,
}: {
  calendar?: Calendar;
  defaultGroupId?: string;
  onClose: () => void;
}) {
  const store = useStore();
  const [name, setName] = useState(calendar?.name ?? "");
  const [color, setColor] = useState<ColorKey>(calendar?.color ?? "teal");
  const [groupId, setGroupId] = useState<string>(
    calendar?.groupId ?? defaultGroupId ?? "",
  );

  const save = () => {
    if (calendar) {
      store.renameCalendar(calendar.id, name);
      store.setCalendarColor(calendar.id, color);
      store.updateCalendarGroup(calendar.id, groupId || undefined);
    } else {
      store.createCalendar({ name, color, groupId: groupId || undefined });
    }
    onClose();
  };

  return (
    <Modal
      title={calendar ? "Calendar settings" : "New calendar"}
      onClose={onClose}
      footer={
        <>
          {calendar && (
            <Button
              variant="danger"
              className="mr-auto"
              disabled={store.calendars.length === 1}
              onClick={() => {
                store.deleteCalendar(calendar.id);
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
            {calendar ? "Save" : "Create"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Holidays, Work, Us…"
            className={inputClass}
          />
        </Field>

        <Field label="Colour">
          <ColorPicker value={color} onChange={setColor} />
        </Field>

        <Field label="Shared with">
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value)}
            className={inputClass}
          >
            <option value="">Just me</option>
            {store.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name} ({g.memberIds.length} people)
              </option>
            ))}
          </select>
          <p className="mt-1.5 text-[12px] text-ink-faint">
            Everyone in the group sees and edits this calendar.
          </p>
        </Field>
      </div>
    </Modal>
  );
}
