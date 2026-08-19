"use client";

import clsx from "clsx";
import { Bell, Mail, Monitor, Plus, User, Users, X } from "lucide-react";
import { useState } from "react";
import type { ReminderChannel, ReminderDraft } from "@/lib/types";

type Draft = ReminderDraft;

const PRESETS = [
  { minutes: 7 * 24 * 60, label: "7 days" },
  { minutes: 2 * 24 * 60, label: "2 days" },
  { minutes: 24 * 60, label: "1 day" },
  { minutes: 4 * 60, label: "4 hours" },
  { minutes: 2 * 60, label: "2 hours" },
  { minutes: 60, label: "1 hour" },
  { minutes: 30, label: "30 min" },
  { minutes: 10, label: "10 min" },
  { minutes: 0, label: "At the time" },
];

export function describeReminder(minutes: number) {
  if (minutes === 0) return "At the time";
  if (minutes % (24 * 60) === 0) {
    const days = minutes / (24 * 60);
    return `${days} day${days === 1 ? "" : "s"} before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return `${hours} hour${hours === 1 ? "" : "s"} before`;
  }
  return `${minutes} min before`;
}

/**
 * Reminders belong to the event, so this is only editable by whoever can edit
 * the event. Everyone else sees what they will be reminded of, and by whom.
 */
export function RemindersField({
  reminders,
  editable,
  authorName,
  onChange,
}: {
  reminders: Draft[];
  editable: boolean;
  authorName?: string;
  onChange: (next: Draft[]) => void;
}) {
  const [adding, setAdding] = useState(false);

  const add = (minutesBefore: number, channel: ReminderChannel = "browser") => {
    if (reminders.some((r) => r.minutesBefore === minutesBefore && r.channel === channel)) {
      return;
    }
    onChange(
      [...reminders, { minutesBefore, channel, forEveryone: false }].sort(
        (a, b) => b.minutesBefore - a.minutesBefore,
      ),
    );
    setAdding(false);
  };

  const remove = (index: number) =>
    onChange(reminders.filter((_, i) => i !== index));

  const setChannel = (index: number, channel: ReminderChannel) =>
    onChange(reminders.map((r, i) => (i === index ? { ...r, channel } : r)));

  const setAudience = (index: number, forEveryone: boolean) =>
    onChange(reminders.map((r, i) => (i === index ? { ...r, forEveryone } : r)));


  return (
    <div className="space-y-2">
      {reminders.length === 0 && (
        <p className="text-[12px] text-ink-faint">
          No reminders. Everyone this event reaches would hear nothing.
        </p>
      )}

      {reminders.map((r, i) => (
        <div
          key={`${r.minutesBefore}-${r.channel}-${i}`}
          className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
        >
          <Bell size={14} className="shrink-0 text-brand" />
          <span className="min-w-0 flex-1 text-[13px] text-ink">
            {describeReminder(r.minutesBefore)}
          </span>

          {/* Just me, or everyone this event reaches. */}
          {editable && (
            <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
              {(
                [
                  [false, User, "Only me"],
                  [true, Users, "Everyone on this event"],
                ] as const
              ).map(([value, Icon, title]) => (
                <button
                  key={String(value)}
                  type="button"
                  title={title}
                  onClick={() => setAudience(i, value)}
                  className={clsx(
                    "flex h-6 w-7 items-center justify-center rounded-md transition",
                    r.forEveryone === value
                      ? "bg-surface text-brand shadow-[var(--shadow-sm)]"
                      : "text-ink-faint hover:text-ink",
                  )}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-0.5 rounded-lg bg-surface-2 p-0.5">
            {(
              [
                ["browser", Monitor, "Notification"],
                ["email", Mail, "Email"],
              ] as const
            ).map(([value, Icon, title]) => (
              <button
                key={value}
                type="button"
                title={title}
                onClick={() => setChannel(i, value)}
                className={clsx(
                  "flex h-6 w-7 items-center justify-center rounded-md transition",
                  r.channel === value
                    ? "bg-surface text-brand shadow-[var(--shadow-sm)]"
                    : "text-ink-faint hover:text-ink",
                )}
              >
                <Icon size={13} />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => remove(i)}
            title="Remove"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-[#d1443c]"
          >
            <X size={13} />
          </button>
        </div>
      ))}

      {adding ? (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 p-2">
          {PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              type="button"
              onClick={() => add(preset.minutes)}
              className="rounded-md border border-line bg-surface px-2 py-1 text-[12px] text-ink transition hover:border-brand/50 hover:text-brand"
            >
              {preset.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-2 py-1 text-[12px] text-ink-faint hover:text-ink"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
        >
          <Plus size={14} /> Add a reminder
        </button>
      )}

      <p className="text-[12px] leading-relaxed text-ink-faint">
        {editable ? (
          <>
            Reminders are yours alone unless you switch one to{" "}
            <Users size={11} className="inline align-[-1px]" /> everyone — those
            reach each person the event is shared with, who can then add their
            own on top.
          </>
        ) : (
          <>
            These are your own reminders for {authorName ?? "this"}&apos;s event.
            Nobody else sees them.
          </>
        )}
      </p>
    </div>
  );
}
