"use client";

import clsx from "clsx";
import { ArrowDownLeft, EyeOff, Lock, Share2, Users } from "lucide-react";
import { effectivePrivacy, provenanceFor, type Provenance } from "@/lib/access";
import { useStore } from "@/lib/store";
import type { CalendarEvent, Person } from "@/lib/types";
import { Avatar } from "./ui";

/** Overlapping avatars, capped with a +N chip. */
export function PeopleStack({
  people,
  size = 18,
  max = 3,
  className,
}: {
  people: Person[];
  size?: number;
  max?: number;
  className?: string;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className={clsx("flex shrink-0 -space-x-1.5", className)}>
      {shown.map((person) => (
        <Avatar
          key={person.id}
          person={person}
          size={size}
          className="ring-2 ring-[var(--surface)]"
        />
      ))}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, fontSize: size * 0.42 }}
          className="inline-flex items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-muted ring-2 ring-[var(--surface)]"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

export interface EventPeople {
  provenance: Provenance;
  /** Everyone who sees this event, minus the viewer. */
  others: Person[];
  /** Who sent it, when it came from someone else. */
  from?: Person;
  /** One-line explanation, used for tooltips and the dialog banner. */
  label: string;
}

const listNames = (people: Person[]) => {
  const names = people.map((p) => p.name);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
};

/** Who is on an event, and how it reached the viewer. */
export function useEventPeople(event: CalendarEvent): EventPeople {
  const store = useStore();
  const calendar = store.calendarById(event.calendarId);
  const provenance = provenanceFor(event, calendar, store.currentUserId);
  const owner = store.personById(event.createdBy);

  if (event.masked) {
    return {
      provenance,
      others: owner ? [owner] : [],
      from: owner,
      label: owner ? `${owner.name} is busy — details are private` : "Busy",
    };
  }

  const others = store
    .participantsOf(event)
    .filter((p) => p.id !== store.currentUserId);
  const from = event.createdBy === store.currentUserId ? undefined : owner;

  let label: string;
  if (provenance === "incoming") {
    label = `${from?.name ?? "Someone"} shared this with you`;
  } else if (provenance === "group") {
    label = calendar
      ? `On the ${calendar.name} calendar — ${others.length ? listNames(others) : "just you"} can see it`
      : "Shared calendar";
  } else if (provenance === "outgoing") {
    label = `Shared with ${listNames(others)}`;
  } else {
    const privacy = effectivePrivacy(event, calendar);
    label =
      privacy === "details"
        ? "Only you — your group can see the details"
        : privacy === "busy"
          ? "Only you — your group sees a busy block"
          : "Only you — hidden from your group";
  }

  return { provenance, others, from, label };
}

export function ProvenanceIcon({
  provenance,
  size = 11,
  className,
}: {
  provenance: Provenance;
  size?: number;
  className?: string;
}) {
  const props = { size, className: clsx("shrink-0", className) };
  if (provenance === "incoming") return <ArrowDownLeft {...props} />;
  if (provenance === "outgoing") return <Share2 {...props} />;
  if (provenance === "group") return <Users {...props} />;
  if (provenance === "busy") return <EyeOff {...props} />;
  return <Lock {...props} />;
}
