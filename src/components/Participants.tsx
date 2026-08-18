"use client";

import clsx from "clsx";
import {
  AlertTriangle,
  ArrowDownLeft,
  EyeOff,
  Lock,
  Paperclip,
  Share2,
  Users,
} from "lucide-react";
import { effectivePrivacy, provenanceFor, type Provenance } from "@/lib/access";
import { formatBytes } from "@/lib/files";
import { useStore } from "@/lib/store";
import type { CalendarEvent, Person } from "@/lib/types";
import { HoverCard } from "./HoverCard";
import { Avatar } from "./ui";

/** Overlapping avatars, capped with a +N chip. */
export function PeopleStack({
  people,
  size = 18,
  max = 3,
  className,
  event,
}: {
  people: Person[];
  size?: number;
  max?: number;
  className?: string;
  /** When given, hovering a face explains what that person did here. */
  event?: CalendarEvent;
}) {
  if (people.length === 0) return null;
  const shown = people.slice(0, max);
  const rest = people.length - shown.length;

  return (
    <span className={clsx("flex shrink-0 -space-x-1.5", className)}>
      {shown.map((person) =>
        event ? (
          <HoverCard
            key={person.id}
            width={280}
            panel={<PersonNotice event={event} person={person} />}
          >
            <Avatar person={person} size={size} className="ring-2 ring-[var(--surface)]" />
          </HoverCard>
        ) : (
          <Avatar
            key={person.id}
            person={person}
            size={size}
            className="ring-2 ring-[var(--surface)]"
          />
        ),
      )}
      {rest > 0 && (
        <span
          style={{ width: size, height: size, fontSize: size * 0.42 }}
          title={people.slice(max).map((p) => p.name).join(", ")}
          className="inline-flex items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-muted ring-2 ring-[var(--surface)]"
        >
          +{rest}
        </span>
      )}
    </span>
  );
}

/**
 * What this person has to do with this event — the note that appears when you
 * hover their face: who shared it, what they attached, whether they flagged it.
 */
export function PersonNotice({
  event,
  person,
}: {
  event: CalendarEvent;
  person: Person;
}) {
  const store = useStore();
  const isMe = person.id === store.currentUserId;
  const isAuthor = event.createdBy === person.id;
  const theirFiles = (event.attachments ?? []).filter((a) => a.uploadedBy === person.id);
  const calendar = store.calendarById(event.calendarId);

  const notes: { icon: React.ReactNode; text: string }[] = [];

  if (isAuthor && !isMe) {
    notes.push({
      icon: <ArrowDownLeft size={13} />,
      text: `${person.name} put this on your calendar.`,
    });
  } else if (isAuthor && isMe) {
    notes.push({ icon: <Share2 size={13} />, text: "You created this event." });
  } else if (event.sharedWith.includes(person.id)) {
    notes.push({
      icon: <Share2 size={13} />,
      text: `Shared directly with ${isMe ? "you" : person.name}.`,
    });
  } else if (calendar?.kind === "shared") {
    notes.push({
      icon: <Users size={13} />,
      text: `${isMe ? "You see" : `${person.name} sees`} this through the ${calendar.name} calendar.`,
    });
  }

  for (const file of theirFiles) {
    notes.push({
      icon: <Paperclip size={13} />,
      text: `${isMe ? "You" : person.name} attached ${file.name} (${formatBytes(file.size)}).`,
    });
  }

  if (event.importance === "urgent") {
    notes.push({
      icon: <AlertTriangle size={13} />,
      text: isAuthor
        ? `${isMe ? "You" : person.name} marked this urgent.`
        : "This event is marked urgent.",
    });
  }

  return (
    <div className="p-3">
      <div className="flex items-center gap-2.5">
        <Avatar person={person} size={30} />
        <span className="min-w-0">
          <span className="block truncate text-[13px] font-semibold text-ink">
            {person.name}
            {isMe && " (you)"}
          </span>
          <span className="block truncate text-[11px] text-ink-faint">{person.email}</span>
        </span>
      </div>

      <ul className="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
        {notes.length === 0 && (
          <li className="text-[12px] text-ink-muted">Can see this event.</li>
        )}
        {notes.map((note, i) => (
          <li key={i} className="flex items-start gap-2 text-[12px] text-ink-muted">
            <span className="mt-px shrink-0 text-brand">{note.icon}</span>
            <span>{note.text}</span>
          </li>
        ))}
      </ul>
    </div>
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
