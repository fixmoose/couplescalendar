import type { Calendar, CalendarEvent, Group, Privacy } from "./types";

/**
 * Who can see what.
 *
 * - "full"  — the whole event: title, times, notes, guests.
 * - "busy"  — only that the time is taken. No details ever leave the owner.
 * - "none"  — the event does not exist as far as this viewer is concerned.
 *
 * These are the same rules the RLS policies in supabase/schema.sql enforce, so
 * the UI never shows something the database would later refuse to hand over.
 */
export type Access = "full" | "busy" | "none";

/** How an event reached the viewer — drives the badge shown on it. */
export type Provenance =
  /** Mine, not shared with anyone. */
  | "private"
  /** Mine, and I pushed it to other people. */
  | "outgoing"
  /** Someone else's, shared with me directly. */
  | "incoming"
  /** Lives on a calendar a whole group shares. */
  | "group"
  /** Someone else's time, details withheld. */
  | "busy";

export function groupById(groups: Group[], id?: string) {
  return id ? groups.find((g) => g.id === id) : undefined;
}

export function isGroupMember(groups: Group[], groupId: string | undefined, userId: string) {
  return Boolean(groupById(groups, groupId)?.memberIds.includes(userId));
}

/** Two people are connected when they sit in at least one group together. */
export function sharesAGroup(groups: Group[], a: string, b: string) {
  if (a === b) return true;
  return groups.some((g) => g.memberIds.includes(a) && g.memberIds.includes(b));
}

/** The event's own setting wins; otherwise the calendar's. */
export function effectivePrivacy(
  event: Pick<CalendarEvent, "privacy">,
  calendar: Calendar | undefined,
): Privacy {
  return event.privacy ?? calendar?.privacy ?? "busy";
}

export function accessFor(
  event: CalendarEvent,
  calendar: Calendar | undefined,
  viewerId: string,
  groups: Group[],
): Access {
  if (!calendar) return "none";
  if (calendar.ownerId === viewerId) return "full";
  if (calendar.kind === "shared" && isGroupMember(groups, calendar.groupId, viewerId)) {
    return "full";
  }
  // An event pushed to you directly always arrives in full — that is the point
  // of sharing it, and it overrides the calendar's privacy setting.
  if (event.sharedWith.includes(viewerId)) return "full";
  if (!sharesAGroup(groups, calendar.ownerId, viewerId)) return "none";

  const privacy = effectivePrivacy(event, calendar);
  if (privacy === "details") return "full";
  if (privacy === "busy") return "busy";
  return "none";
}

/** Everyone who can see this event in full — the owner plus whoever it reached. */
export function participantIds(
  event: CalendarEvent,
  calendar: Calendar | undefined,
  groups: Group[],
): string[] {
  const ids = new Set<string>([event.createdBy]);
  if (calendar) {
    ids.add(calendar.ownerId);
    if (calendar.kind === "shared") {
      for (const id of groupById(groups, calendar.groupId)?.memberIds ?? []) ids.add(id);
    }
  }
  for (const id of event.sharedWith) ids.add(id);
  return [...ids];
}

export function provenanceFor(
  event: CalendarEvent,
  calendar: Calendar | undefined,
  viewerId: string,
): Provenance {
  if (event.masked) return "busy";
  if (calendar?.kind === "shared") return "group";
  if (event.createdBy !== viewerId) return "incoming";
  return event.sharedWith.length > 0 ? "outgoing" : "private";
}

/** Only the owner (or a member of the owning group) may edit. */
export function canEdit(
  calendar: Calendar | undefined,
  viewerId: string,
  groups: Group[],
) {
  if (!calendar) return false;
  if (calendar.ownerId === viewerId) return true;
  return calendar.kind === "shared" && isGroupMember(groups, calendar.groupId, viewerId);
}

/**
 * Strips an event down to "this time is taken". Everything identifying is
 * dropped here rather than hidden in the UI, so a masked event cannot leak
 * details through a tooltip, a search match or the dialog.
 */
export function maskEvent(event: CalendarEvent, ownerId: string): CalendarEvent {
  return {
    id: event.id,
    calendarId: event.calendarId,
    title: "Busy",
    start: event.start,
    end: event.end,
    allDay: event.allDay,
    createdBy: ownerId,
    sharedWith: [],
    color: "slate",
    masked: true,
  };
}
