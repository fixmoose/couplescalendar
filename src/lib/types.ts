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
  /** Google profile picture, when the account came from OAuth. */
  avatarUrl?: string;
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
  /** What people who share a group with the owner get to see. */
  privacy: Privacy;
}

/**
 * The owner's choice, per calendar (and overridable per event):
 * - "details" — group members see the event exactly as the owner does.
 * - "busy"    — they see an anonymous grey block: the time is taken, nothing more.
 * - "hidden"  — they see nothing at all.
 */
export type Privacy = "details" | "busy" | "hidden";

/** A file dropped onto the calendar: prescription, ticket, invoice, photo. */
export interface Attachment {
  id: string;
  name: string;
  size: number;
  /** MIME type, used to decide between a preview and an icon. */
  type: string;
  uploadedBy: string;
  uploadedAt: string;
  /** Set once the file lives in Supabase Storage; local files use IndexedDB. */
  path?: string;
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
  /** Overrides the calendar's privacy for this one event. */
  privacy?: Privacy;
  /** Flagged by whoever created it, and called out to everyone who sees it. */
  importance?: Importance;
  /** Files dropped onto this event. Never exposed on a masked event. */
  attachments?: Attachment[];
  /** Set when the event was imported from a subscribed calendar. */
  feedId?: string;
  /** When to remind everyone who can see this event. */
  reminders?: Reminder[];
  /**
   * Set by the store when the viewer may only see that this time is taken.
   * Masked events carry no details — see maskEvent() in lib/access.ts.
   */
  masked?: boolean;
}

export type Importance = "normal" | "urgent";

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
  /** Addresses with no account yet — they get an emailed invitation. */
  inviteEmails?: string[];
  /** Per-event override of the calendar's privacy; undefined = inherit. */
  privacy?: Privacy;
  importance?: Importance;
  attachments?: Attachment[];
  /** Minutes-before/channel pairs; ids are assigned when saved. */
  reminders?: { minutesBefore: number; channel: ReminderChannel }[];
}

export type ReminderChannel = "browser" | "email";

/**
 * A reminder is a property of the event: the creator sets it, and everyone the
 * event reaches gets it. Recipients cannot switch it off, and the creator
 * cannot switch it off for one recipient in particular.
 */
export interface Reminder {
  id: string;
  eventId: string;
  minutesBefore: number;
  channel: ReminderChannel;
}

/** What a new event starts with unless you change it. */
export const DEFAULT_REMINDERS: { minutesBefore: number; channel: ReminderChannel }[] = [
  { minutesBefore: 24 * 60, channel: "browser" },
  { minutesBefore: 2 * 60, channel: "browser" },
];

/** A Google or Outlook calendar we mirror by its iCal address. */
export interface Feed {
  id: string;
  calendarId: string;
  name: string;
  url: string;
  mode: "once" | "auto";
  intervalMinutes: number;
  lastSyncedAt?: string;
  lastStatus?: string;
  lastError?: string;
  eventCount: number;
}

/** An emailed invitation to join CouplesCalendar. */
export interface Invite {
  id: string;
  email: string;
  invitedBy: string;
  groupId?: string;
  /** Set when the invitation is about one event rather than a group. */
  eventId?: string;
  status: "pending" | "sent" | "failed" | "accepted";
  createdAt: string;
  /** Token that ends up in the invite link. */
  token: string;
  error?: string;
}
