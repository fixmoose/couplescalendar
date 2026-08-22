"use client";

import clsx from "clsx";
import { Repeat } from "lucide-react";
import { format } from "date-fns";
import { fromRule, toRule, type RepeatChoice, type RepeatKind } from "@/lib/repeat";
import { controlClass } from "./ui";

/**
 * How often it happens: the mortgage on the 1st, the bins on a Tuesday.
 *
 * Deliberately a short list rather than a rule builder. Everything here is
 * something people actually say out loud, and anything stranger — the second
 * Tuesday, every third month — arrives from an imported calendar and is shown
 * as it was written rather than being editable into nonsense.
 */

const KINDS: { value: RepeatKind; label: string }[] = [
  { value: "none", label: "Does not repeat" },
  { value: "daily", label: "Every day" },
  { value: "weekly", label: "Every week" },
  { value: "fortnightly", label: "Every two weeks" },
  { value: "monthly", label: "Every month" },
  { value: "yearly", label: "Every year" },
];

const WEEKDAYS = ["M", "T", "W", "T", "F", "S", "S"];

export function RepeatField({
  rule,
  start,
  onChange,
}: {
  rule: string | undefined;
  start: Date;
  onChange: (rule: string | undefined) => void;
}) {
  const choice = fromRule(rule);
  const set = (next: RepeatChoice) => onChange(toRule(next, start));

  if (choice.kind === "custom") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 py-2">
        <Repeat size={14} className="shrink-0 text-ink-faint" />
        <span className="min-w-0 flex-1 text-[13px] text-ink-muted">
          Repeats on a pattern set elsewhere — left as it is.
        </span>
        <button
          type="button"
          onClick={() => onChange(undefined)}
          className="shrink-0 text-[12px] font-medium text-brand hover:underline"
        >
          Stop repeating
        </button>
      </div>
    );
  }

  const weekly = choice.kind === "weekly" || choice.kind === "fortnightly";
  // Nothing chosen means the day the event starts on, which is what rrule does.
  const days = choice.weekdays?.length ? choice.weekdays : [(start.getDay() + 6) % 7];

  return (
    <div className="space-y-2">
      <select
        value={choice.kind}
        onChange={(e) => set({ ...choice, kind: e.target.value as RepeatKind })}
        className={`${controlClass} w-full py-2 text-[13px]`}
      >
        {KINDS.map((k) => (
          <option key={k.value} value={k.value}>
            {k.label}
            {k.value === "monthly" ? ` — on the ${format(start, "do")}` : ""}
            {k.value === "yearly" ? ` — on ${format(start, "d MMMM")}` : ""}
          </option>
        ))}
      </select>

      {weekly && (
        <div className="flex gap-1">
          {WEEKDAYS.map((label, index) => {
            const on = days.includes(index);
            return (
              <button
                key={index}
                type="button"
                onClick={() => {
                  const next = on ? days.filter((d) => d !== index) : [...days, index];
                  // Never nothing: a weekly event has to land somewhere.
                  set({ ...choice, weekdays: next.length ? next.sort() : days });
                }}
                aria-pressed={on}
                className={clsx(
                  "h-8 flex-1 rounded-lg border text-[12px] font-semibold transition",
                  on
                    ? "border-brand bg-brand text-white"
                    : "border-line text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {choice.kind !== "none" && (
        <div className="flex items-center gap-2">
          <select
            value={choice.until ? "until" : choice.count ? "count" : "forever"}
            onChange={(e) => {
              const mode = e.target.value;
              if (mode === "forever") set({ ...choice, count: undefined, until: undefined });
              if (mode === "count") set({ ...choice, count: 10, until: undefined });
              if (mode === "until") {
                const until = new Date(start);
                until.setFullYear(until.getFullYear() + 1);
                set({ ...choice, count: undefined, until });
              }
            }}
            className={`${controlClass} py-1.5 text-[13px]`}
          >
            <option value="forever">Goes on forever</option>
            <option value="count">Stops after</option>
            <option value="until">Stops on</option>
          </select>

          {choice.count !== undefined && (
            <>
              <input
                type="number"
                min={1}
                max={999}
                value={choice.count}
                onChange={(e) =>
                  set({ ...choice, count: Math.max(1, Number(e.target.value) || 1) })
                }
                className={`${controlClass} w-20 py-1.5 text-[13px]`}
              />
              <span className="text-[13px] text-ink-muted">times</span>
            </>
          )}

          {choice.until && (
            <input
              type="date"
              value={format(choice.until, "yyyy-MM-dd")}
              onChange={(e) =>
                e.target.value && set({ ...choice, until: new Date(e.target.value) })
              }
              className={`${controlClass} py-1.5 text-[13px]`}
            />
          )}
        </div>
      )}
    </div>
  );
}
