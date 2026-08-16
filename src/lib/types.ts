/**
 * Domain model for CouplesCalendar.
 *
 * These types deliberately mirror the shape we will store in Supabase
 * (tables prefixed `CC_`), so moving from the local store to the database
 * is a swap of the store implementation, not a rewrite of the UI.
 */

/** Named palette entries — a calendar picks one, events inherit it. */
export type ColorKey =
  | "orange"
  | "teal"
  | "violet"
  | "rose"
  | "blue"
  | "green"
  | "amber"
  | "slate";

export interface Person {
  id: string;
  name: string;
  email: string;
  /** Initials shown in avatars when there is no image. */
  avatarColor: ColorKey;
}

export interface Group {
  id: string;
  name: string;
  ownerId: string;
  memberIds: string[];
}

export type CalendarKind =
  /** Belongs to one person. */
  | "personal"
  /** Belongs to a group; every member reads and writes it. */
  | "shared";

export interface Calendar {
  id: string;
  name: string;
  kind: CalendarKind;
  color: ColorKey;
  ownerId: string;
  /** Set when kind === "shared". */
  groupId?: string;
  /** Toggled by the sidebar checkboxes — a view concern we persist per user. */
  visible: boolean;
}

export interface CalendarEvent {
  id: string;
  calendarId: string;
  title: string;
  notes?: string;
  location?: string;
  /** ISO strings. For all-day events the time part is ignored. */
  start: string;
  end: string;
  allDay: boolean;
  /** Overrides the calendar colour when set. */
  color?: ColorKey;
  createdBy: string;
  /**
   * People this event was pushed to individually (the right-click → "Add to
   * someone's calendar" flow). Distinct from sharing a whole calendar.
   */
  sharedWith: string[];
}

export type CalendarView = "month" | "week" | "day" | "agenda";

/** Draft used by the event dialog before an id exists. */
export interface EventDraft {
  id?: string;
  calendarId: string;
  title: string;
  notes: string;
  location: string;
  start: Date;
  end: Date;
  allDay: boolean;
  sharedWith: string[];
}
