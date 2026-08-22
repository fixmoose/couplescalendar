import { RRule } from "rrule";
import type { CalendarEvent } from "./types";

/**
 * Repeating events, expanded for display.
 *
 * The mortgage on the 1st is one row with a rule on it, not 360 rows. The
 * calendar needs the occurrences, so they are worked out here for whatever
 * range is on screen — and thrown away again. Only the rule is ever stored.
 *
 * Each occurrence carries the id of the series it came from and the instant it
 * belongs to, which is how "just this one" tells the database which Tuesday it
 * means.
 */

/** The shapes offered in the dialog, in the order they are shown. */
export type RepeatKind =
  | "none"
  | "daily"
  | "weekly"
  | "fortnightly"
  | "monthly"
  | "yearly"
  | "custom";

export interface RepeatChoice {
  kind: RepeatKind;
  /** Weekly only: which days, 0 = Monday. Empty means the start day. */
  weekdays?: number[];
  /** Stops after this many occurrences, or on this date. Neither = forever. */
  count?: number;
  until?: Date;
}

const DAYS = [RRule.MO, RRule.TU, RRule.WE, RRule.TH, RRule.FR, RRule.SA, RRule.SU];

/** An RRULE string from what the dialog collected. */
export function toRule(choice: RepeatChoice, start: Date): string | undefined {
  if (choice.kind === "none" || choice.kind === "custom") return undefined;

  const options: Partial<ConstructorParameters<typeof RRule>[0]> = { dtstart: start };

  if (choice.kind === "daily") options.freq = RRule.DAILY;
  if (choice.kind === "weekly" || choice.kind === "fortnightly") {
    options.freq = RRule.WEEKLY;
    if (choice.kind === "fortnightly") options.interval = 2;
    if (choice.weekdays?.length) options.byweekday = choice.weekdays.map((d) => DAYS[d]);
  }
  if (choice.kind === "monthly") options.freq = RRule.MONTHLY;
  if (choice.kind === "yearly") options.freq = RRule.YEARLY;

  if (choice.count) options.count = choice.count;
  if (choice.until) options.until = choice.until;

  return new RRule(options as ConstructorParameters<typeof RRule>[0]).toString();
}

/** Reads a stored rule back into what the dialog shows. */
export function fromRule(rule: string | undefined): RepeatChoice {
  if (!rule) return { kind: "none" };
  try {
    const parsed = RRule.fromString(rule);
    const { freq, interval, byweekday, count, until } = parsed.options;
    const ends = {
      ...(count ? { count } : {}),
      ...(until ? { until: new Date(until) } : {}),
    };

    // rrule reports weekdays as 0 = Monday, which is the order used here too.
    const weekdays = Array.isArray(byweekday) ? byweekday.map(Number) : undefined;

    if (freq === RRule.DAILY && (interval ?? 1) === 1) return { kind: "daily", ...ends };
    if (freq === RRule.WEEKLY && (interval ?? 1) === 1)
      return { kind: "weekly", weekdays, ...ends };
    if (freq === RRule.WEEKLY && interval === 2)
      return { kind: "fortnightly", weekdays, ...ends };
    if (freq === RRule.MONTHLY && (interval ?? 1) === 1) return { kind: "monthly", ...ends };
    if (freq === RRule.YEARLY && (interval ?? 1) === 1) return { kind: "yearly", ...ends };
    return { kind: "custom", ...ends };
  } catch {
    return { kind: "none" };
  }
}

/** How the repeat reads in a sentence, for the event dialog and hover cards. */
export function describeRule(rule: string | undefined): string | undefined {
  if (!rule) return undefined;
  try {
    const text = RRule.fromString(rule).toText();
    return text.charAt(0).toUpperCase() + text.slice(1);
  } catch {
    return "Repeats";
  }
}

/** The synthetic id an occurrence carries: the series, and which one. */
export const occurrenceId = (eventId: string, start: Date) =>
  `${eventId}::${start.toISOString()}`;

/** Splits that back apart. A plain id comes back as itself, with no instant. */
export function splitOccurrenceId(id: string): { eventId: string; start?: Date } {
  const at = id.indexOf("::");
  if (at < 0) return { eventId: id };
  return { eventId: id.slice(0, at), start: new Date(id.slice(at + 2)) };
}

/** An event that repeats, capped so one silly rule cannot fill the screen. */
const MAX_PER_EVENT = 400;

/**
 * Turns a list holding repeating events into one holding their occurrences,
 * within the given range. Events that do not repeat pass straight through.
 */
export function expandRepeats(
  events: CalendarEvent[],
  from: Date,
  to: Date,
  /** "<event id>::<occurrence ISO>" for the ones that are not happening. */
  skipped: Set<string> = new Set(),
): CalendarEvent[] {
  const out: CalendarEvent[] = [];

  for (const event of events) {
    if (!event.rrule) {
      out.push(event);
      continue;
    }

    const start = new Date(event.start);
    const durationMs = new Date(event.end).getTime() - start.getTime();

    let occurrences: Date[];
    try {
      occurrences = RRule.fromString(event.rrule).between(from, to, true);
    } catch {
      // A rule we cannot read should still show the event it came from.
      out.push(event);
      continue;
    }

    for (const at of occurrences.slice(0, MAX_PER_EVENT)) {
      const id = occurrenceId(event.id, at);
      if (skipped.has(id)) continue;
      out.push({
        ...event,
        id,
        seriesId: event.id,
        occurrenceStart: at.toISOString(),
        start: at.toISOString(),
        end: new Date(at.getTime() + durationMs).toISOString(),
      });
    }
  }

  return out;
}
