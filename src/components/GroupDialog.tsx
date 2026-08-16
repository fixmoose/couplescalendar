"use client";

import clsx from "clsx";
import { Check, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { useStore } from "@/lib/store";
import type { Group } from "@/lib/types";
import { Avatar, Button, Field, Modal, inputClass } from "./ui";

export function GroupDialog({
  group,
  onClose,
}: {
  group?: Group;
  onClose: () => void;
}) {
  const store = useStore();
  const [name, setName] = useState(group?.name ?? "");
  const [members, setMembers] = useState<string[]>(
    group?.memberIds ?? [store.currentUserId],
  );
  const [email, setEmail] = useState("");
  const [withCalendar, setWithCalendar] = useState(!group);

  const toggle = (id: string) =>
    setMembers((current) =>
      current.includes(id)
        ? current.filter((m) => m !== id)
        : [...current, id],
    );

  const invite = () => {
    const value = email.trim();
    if (!value.includes("@")) return;
    const person = store.invitePerson(value);
    setMembers((current) =>
      current.includes(person.id) ? current : [...current, person.id],
    );
    setEmail("");
  };

  const save = () => {
    if (group) {
      store.renameGroup(group.id, name);
      store.setGroupMembers(group.id, members);
    } else {
      const created = store.createGroup(name, members);
      if (withCalendar) {
        store.createCalendar({
          name: created.name,
          color: "violet",
          groupId: created.id,
        });
      }
    }
    onClose();
  };

  return (
    <Modal
      title={group ? "Group settings" : "New group"}
      onClose={onClose}
      footer={
        <>
          {group && (
            <Button
              variant="danger"
              className="mr-auto"
              onClick={() => {
                store.deleteGroup(group.id);
                onClose();
              }}
            >
              <Trash2 size={15} /> Delete group
            </Button>
          )}
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={save}>
            {group ? "Save" : "Create group"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Group name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && save()}
            placeholder="Us, Family, Flatmates…"
            className={inputClass}
          />
        </Field>

        <Field label="Members">
          <div className="space-y-1">
            {store.people.map((person) => {
              const isMe = person.id === store.currentUserId;
              const on = members.includes(person.id) || isMe;
              return (
                <button
                  key={person.id}
                  type="button"
                  disabled={isMe}
                  onClick={() => toggle(person.id)}
                  className={clsx(
                    "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition",
                    on
                      ? "border-brand/40 bg-brand-soft"
                      : "border-line hover:bg-surface-2",
                    isMe && "opacity-70",
                  )}
                >
                  <Avatar person={person} size={26} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium text-ink">
                      {person.name}
                      {isMe && " (you)"}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint">
                      {person.email}
                    </span>
                  </span>
                  {on && <Check size={15} className="text-brand" />}
                </button>
              );
            })}
          </div>
        </Field>

        <Field label="Invite by email">
          <div className="flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
              placeholder="name@example.com"
              className={inputClass}
            />
            <Button variant="outline" onClick={invite} className="shrink-0">
              <UserPlus size={15} /> Add
            </Button>
          </div>
        </Field>

        {!group && (
          <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink-muted">
            <input
              type="checkbox"
              checked={withCalendar}
              onChange={(e) => setWithCalendar(e.target.checked)}
              className="h-4 w-4 accent-[var(--cc-brand)]"
            />
            Also create a shared calendar for this group
          </label>
        )}
      </div>
    </Modal>
  );
}
