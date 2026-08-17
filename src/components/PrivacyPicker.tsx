"use client";

import clsx from "clsx";
import { Eye, EyeOff, Lock, Settings2 } from "lucide-react";
import type { Privacy } from "@/lib/types";

type Value = Privacy | "inherit";

const OPTIONS: {
  value: Value;
  label: string;
  icon: typeof Eye;
  help: (subject: string) => string;
}[] = [
  {
    value: "details",
    label: "Show details",
    icon: Eye,
    help: (s) => `Everyone in your groups sees ${s} exactly as you do.`,
  },
  {
    value: "busy",
    label: "Busy only",
    icon: EyeOff,
    help: (s) =>
      `Your groups see a grey “Busy” block for ${s} — no title, no place, no guests.`,
  },
  {
    value: "hidden",
    label: "Hidden",
    icon: Lock,
    help: (s) => `${s.charAt(0).toUpperCase()}${s.slice(1)} is invisible to everyone else.`,
  },
  {
    value: "inherit",
    label: "Calendar default",
    icon: Settings2,
    help: () => "Follows whatever the calendar is set to.",
  },
];

/**
 * The owner's call: how much of this calendar (or single event) the rest of
 * the group gets to see. People an event is shared with directly always see it
 * in full — that is what sharing means.
 */
export function PrivacyPicker({
  value,
  onChange,
  subject,
  allowInherit = false,
}: {
  value: Privacy | undefined;
  onChange: (value: Privacy | undefined) => void;
  /** Reads inside the help line, e.g. "this calendar" / "this event". */
  subject: string;
  allowInherit?: boolean;
}) {
  const current: Value = value ?? (allowInherit ? "inherit" : "busy");
  // "Calendar default" leads for events — it is the answer most of the time.
  const options = allowInherit
    ? [OPTIONS[3], ...OPTIONS.slice(0, 3)]
    : OPTIONS.slice(0, 3);
  const active = options.find((o) => o.value === current) ?? options[0];

  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((option) => {
          const Icon = option.icon;
          const on = option.value === current;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() =>
                onChange(option.value === "inherit" ? undefined : option.value)
              }
              className={clsx(
                "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] transition",
                on
                  ? "border-brand/50 bg-brand-soft font-medium text-brand"
                  : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon size={14} />
              {option.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1.5 text-[12px] text-ink-faint">{active.help(subject)}</p>
    </div>
  );
}
