"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { COLOR_KEYS } from "./colors";
import type {
  Attachment,
  Calendar,
  CalendarEvent,
  ColorKey,
  EventDraft,
  Feed,
  Group,
  Importance,
  Invite,
  Person,
  Privacy,
  Reminder,
  ReminderChannel,
} from "./types";

/**
 * Every query the app makes, in one place.
 *
 * Reads of events go through the `cc_calendar_feed` view, never `cc_events`:
 * the view is what applies the busy masking, so anything the viewer may only
 * see as "busy" arrives already stripped of its details. Writes go to the
 * tables, where row level security decides what is allowed.
 */

export const ATTACHMENT_BUCKET = "cc_attachments";

type Client = SupabaseClient;

const asColor = (value: string | null): ColorKey =>
  (COLOR_KEYS as string[]).includes(value ?? "") ? (value as ColorKey) : "slate";

/* ------------------------------------------------------------------ *
 * Row mappers
 * ------------------------------------------------------------------ */

interface ProfileRow {
  id: string;
  email: string;
  display_name: string;
  avatar_color: string;
  avatar_url: string | null;
}

const toPerson = (row: ProfileRow): Person => ({
  id: row.id,
  name: row.display_name,
  email: row.email,
  avatarColor: asColor(row.avatar_color),
  avatarUrl: row.avatar_url ?? undefined,
});

interface CalendarRow {
  id: string;
  name: string;
  kind: "personal" | "shared";
  color: string;
  owner_id: string;
  group_id: string | null;
  privacy: Privacy;
}

const toCalendar = (row: CalendarRow, visible: boolean): Calendar => ({
  id: row.id,
  name: row.name,
  kind: row.kind,
  color: asColor(row.color),
  ownerId: row.owner_id,
  groupId: row.group_id ?? undefined,
  privacy: row.privacy,
  visible,
});

interface FeedRow {
  id: string;
  calendar_id: string;
  owner_id: string;
  title: string;
  notes: string | null;
  location: string | null;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  color: string | null;
  privacy: Privacy | null;
  importance: Importance;
  created_by: string;
  feed_id: string | null;
  masked: boolean;
}

interface AttachmentRow {
  id: string;
  event_id: string;
  name: string;
  size_bytes: number;
  mime_type: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string;
}

const toAttachment = (row: AttachmentRow): Attachment => ({
  id: row.id,
  name: row.name,
  size: Number(row.size_bytes),
  type: row.mime_type,
  uploadedBy: row.uploaded_by,
  uploadedAt: row.created_at,
  path: row.storage_path,
});

interface InviteRow {
  id: string;
  email: string;
  token: string;
  invited_by: string;
  group_id: string | null;
  event_id: string | null;
  status: Invite["status"];
  error: string | null;
  created_at: string;
}

const toInvite = (row: InviteRow): Invite => ({
  id: row.id,
  email: row.email,
  token: row.token,
  invitedBy: row.invited_by,
  groupId: row.group_id ?? undefined,
  eventId: row.event_id ?? undefined,
  status: row.status,
  error: row.error ?? undefined,
  createdAt: row.created_at,
});

/* ------------------------------------------------------------------ *
 * Loading
 * ------------------------------------------------------------------ */

export interface Workspace {
  people: Person[];
  groups: Group[];
  calendars: Calendar[];
  events: CalendarEvent[];
  invites: Invite[];
  feeds: Feed[];
}

interface FeedRow {
  id: string;
  calendar_id: string;
  name: string;
  url: string;
  mode: "once" | "auto";
  interval_minutes: number;
  last_synced_at: string | null;
  last_status: string | null;
  last_error: string | null;
  event_count: number;
}

const toFeed = (row: FeedRow): Feed => ({
  id: row.id,
  calendarId: row.calendar_id,
  name: row.name,
  url: row.url,
  mode: row.mode,
  intervalMinutes: row.interval_minutes,
  lastSyncedAt: row.last_synced_at ?? undefined,
  lastStatus: row.last_status ?? undefined,
  lastError: row.last_error ?? undefined,
  eventCount: row.event_count,
});

interface ReminderRow {
  id: string;
  event_id: string;
  minutes_before: number;
  channel: "browser" | "email";
}

const toReminder = (row: ReminderRow): Reminder => ({
  id: row.id,
  eventId: row.event_id,
  minutesBefore: row.minutes_before,
  channel: row.channel,
});

/** Replaces an event's reminders with exactly this set. */
export async function setReminders(
  supabase: Client,
  eventId: string,
  reminders: { minutesBefore: number; channel: ReminderChannel }[],
) {
  const { error: clearError } = await supabase
    .from("cc_event_reminders")
    .delete()
    .eq("event_id", eventId);
  if (clearError) throw clearError;

  if (!reminders.length) return;
  const { error } = await supabase.from("cc_event_reminders").insert(
    reminders.map((r) => ({
      event_id: eventId,
      minutes_before: r.minutesBefore,
      channel: r.channel,
    })),
  );
  if (error) throw error;
}

/** Subscribing to a calendar creates the calendar it lands in, then the feed. */
export async function insertFeed(
  supabase: Client,
  input: {
    name: string;
    url: string;
    color: ColorKey;
    mode: "once" | "auto";
    intervalMinutes: number;
  },
) {
  const calendarId = await insertCalendar(supabase, {
    name: input.name,
    color: input.color,
    privacy: "busy",
  });

  const { data, error } = await supabase
    .from("cc_calendar_feeds")
    .insert({
      calendar_id: calendarId,
      name: input.name,
      url: input.url,
      mode: input.mode,
      interval_minutes: input.intervalMinutes,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function deleteFeed(supabase: Client, id: string) {
  const { error } = await supabase.from("cc_calendar_feeds").delete().eq("id", id);
  if (error) throw error;
}

/**
 * Makes sure this app has a profile and a starter calendar for the signed-in
 * user. Cheap and idempotent, so it runs on every load rather than relying on
 * a trigger against the shared auth.users table.
 */
export async function bootstrapMe(supabase: Client) {
  const { error } = await supabase.rpc("cc_bootstrap_me");
  if (error) throw error;
}

/** Everything the calendar needs, in one round of parallel queries. */
export async function loadWorkspace(
  supabase: Client,
  hiddenCalendarIds: Set<string>,
): Promise<Workspace> {
  const [profiles, groups, members, calendars, feed, guests, attachments, invites, reminders, feeds] =
    await Promise.all([
      supabase.from("cc_profiles").select("id,email,display_name,avatar_color,avatar_url"),
      supabase.from("cc_groups").select("id,name,owner_id"),
      supabase.from("cc_group_members").select("group_id,user_id"),
      supabase
        .from("cc_calendars")
        .select("id,name,kind,color,owner_id,group_id,privacy")
        .order("created_at"),
      supabase
        .from("cc_calendar_feed")
        .select(
          "id,calendar_id,owner_id,title,notes,location,starts_at,ends_at,all_day,color,privacy,importance,created_by,feed_id,masked",
        ),
      supabase.from("cc_event_guests").select("event_id,user_id"),
      supabase
        .from("cc_attachments")
        .select("id,event_id,name,size_bytes,mime_type,storage_path,uploaded_by,created_at"),
      supabase
        .from("cc_invitations")
        .select("id,email,token,invited_by,group_id,event_id,status,error,created_at")
        .order("created_at", { ascending: false }),
      supabase.from("cc_event_reminders").select("id,event_id,minutes_before,channel"),
      supabase
        .from("cc_calendar_feeds")
        .select(
          "id,calendar_id,name,url,mode,interval_minutes,last_synced_at,last_status,last_error,event_count",
        )
        .order("created_at"),
    ]);

  const firstError = [profiles, groups, members, calendars, feed, guests, attachments, invites, reminders, feeds]
    .map((r) => r.error)
    .find(Boolean);
  if (firstError) throw firstError;

  const memberships = new Map<string, string[]>();
  for (const row of (members.data ?? []) as { group_id: string; user_id: string }[]) {
    memberships.set(row.group_id, [...(memberships.get(row.group_id) ?? []), row.user_id]);
  }

  const sharesByEvent = new Map<string, string[]>();
  for (const row of (guests.data ?? []) as { event_id: string; user_id: string }[]) {
    sharesByEvent.set(row.event_id, [...(sharesByEvent.get(row.event_id) ?? []), row.user_id]);
  }

  const remindersByEvent = new Map<string, Reminder[]>();
  for (const row of (reminders.data ?? []) as ReminderRow[]) {
    remindersByEvent.set(row.event_id, [
      ...(remindersByEvent.get(row.event_id) ?? []),
      toReminder(row),
    ]);
  }

  const filesByEvent = new Map<string, Attachment[]>();
  for (const row of (attachments.data ?? []) as AttachmentRow[]) {
    filesByEvent.set(row.event_id, [
      ...(filesByEvent.get(row.event_id) ?? []),
      toAttachment(row),
    ]);
  }

  return {
    people: ((profiles.data ?? []) as ProfileRow[]).map(toPerson),
    groups: ((groups.data ?? []) as { id: string; name: string; owner_id: string }[]).map(
      (row) => ({
        id: row.id,
        name: row.name,
        ownerId: row.owner_id,
        memberIds: memberships.get(row.id) ?? [row.owner_id],
      }),
    ),
    calendars: ((calendars.data ?? []) as CalendarRow[]).map((row) =>
      toCalendar(row, !hiddenCalendarIds.has(row.id)),
    ),
    events: ((feed.data ?? []) as FeedRow[]).map((row) => ({
      id: row.id,
      calendarId: row.calendar_id,
      title: row.title,
      notes: row.notes ?? undefined,
      location: row.location ?? undefined,
      start: row.starts_at,
      end: row.ends_at,
      allDay: row.all_day,
      color: row.color ? asColor(row.color) : undefined,
      privacy: row.privacy ?? undefined,
      importance: row.importance === "urgent" ? "urgent" : undefined,
      createdBy: row.created_by,
      sharedWith: sharesByEvent.get(row.id) ?? [],
      attachments: filesByEvent.get(row.id),
      feedId: row.feed_id ?? undefined,
      reminders: remindersByEvent.get(row.id),
      masked: row.masked || undefined,
    })),
    invites: ((invites.data ?? []) as InviteRow[]).map(toInvite),
    feeds: ((feeds.data ?? []) as FeedRow[]).map(toFeed),
  };
}

/* ------------------------------------------------------------------ *
 * Events
 * ------------------------------------------------------------------ */

/** created_by is filled by the database from the session — see the schema. */
const eventPayload = (draft: EventDraft) => ({
  calendar_id: draft.calendarId,
  title: draft.title.trim() || "(no title)",
  notes: draft.notes.trim() || null,
  location: draft.location.trim() || null,
  starts_at: draft.start.toISOString(),
  ends_at: draft.end.toISOString(),
  all_day: draft.allDay,
  privacy: draft.privacy ?? null,
  importance: draft.importance ?? "normal",
});

export async function insertEvent(supabase: Client, draft: EventDraft, userId: string) {
  const { data, error } = await supabase
    .from("cc_events")
    .insert(eventPayload(draft))
    .select("id")
    .single();
  if (error) throw error;

  const eventId = data.id as string;
  await Promise.all([
    setShares(supabase, eventId, draft.sharedWith, userId),
    linkAttachments(supabase, eventId, draft.attachments ?? [], userId),
    setReminders(supabase, eventId, draft.reminders ?? []),
  ]);
  return eventId;
}

export async function updateEvent(
  supabase: Client,
  id: string,
  draft: EventDraft,
  userId: string,
) {
  const { error } = await supabase
    .from("cc_events")
    .update(eventPayload(draft))
    .eq("id", id);
  if (error) throw error;
  await Promise.all([
    setShares(supabase, id, draft.sharedWith, userId),
    linkAttachments(supabase, id, draft.attachments ?? [], userId),
    setReminders(supabase, id, draft.reminders ?? []),
  ]);
}

export async function patchEvent(
  supabase: Client,
  id: string,
  changes: Record<string, unknown>,
) {
  const { error } = await supabase.from("cc_events").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteEvent(supabase: Client, id: string) {
  const { error } = await supabase.from("cc_events").delete().eq("id", id);
  if (error) throw error;
}

export async function duplicateEvent(supabase: Client, id: string, userId: string) {
  const { data, error } = await supabase
    .from("cc_events")
    .select("calendar_id,title,notes,location,starts_at,ends_at,all_day,color,privacy,importance")
    .eq("id", id)
    .single();
  if (error) throw error;

  const { data: created, error: insertError } = await supabase
    .from("cc_events")
    .insert({ ...data, title: `${data.title} (copy)`, created_by: userId })
    .select("id")
    .single();
  if (insertError) throw insertError;
  return created.id as string;
}

/** Replaces the guest list with exactly these people. */
export async function setShares(
  supabase: Client,
  eventId: string,
  userIds: string[],
  sharedBy: string,
) {
  const { error: clearError } = await supabase
    .from("cc_event_shares")
    .delete()
    .eq("event_id", eventId);
  if (clearError) throw clearError;

  if (!userIds.length) return;
  const { error } = await supabase.from("cc_event_shares").insert(
    userIds.map((user_id) => ({ event_id: eventId, user_id, shared_by: sharedBy })),
  );
  if (error) throw error;
}

/* ------------------------------------------------------------------ *
 * Attachments
 * ------------------------------------------------------------------ */

/**
 * Uploads into the caller's own prefix. Files are uploaded before the event
 * exists (drop-to-create), which is why the storage policy keys on the user
 * folder and the database row does the linking afterwards.
 */
export async function uploadAttachment(
  supabase: Client,
  file: File,
  userId: string,
): Promise<Attachment> {
  const id = crypto.randomUUID();
  const safeName = file.name.replace(/[^\w.\- ]+/g, "_").slice(-80);
  const path = `${userId}/${id}-${safeName}`;

  const { error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .upload(path, file, { contentType: file.type || "application/octet-stream" });
  if (error) throw error;

  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploadedBy: userId,
    uploadedAt: new Date().toISOString(),
    path,
  };
}

/** Writes rows for any attachment that is not recorded against the event yet. */
export async function linkAttachments(
  supabase: Client,
  eventId: string,
  attachments: Attachment[],
  userId: string,
) {
  if (!attachments.length) return;
  const { error } = await supabase.from("cc_attachments").upsert(
    attachments.map((a) => ({
      id: a.id,
      event_id: eventId,
      name: a.name,
      size_bytes: a.size,
      mime_type: a.type,
      storage_path: a.path!,
      uploaded_by: a.uploadedBy || userId,
    })),
    { onConflict: "id" },
  );
  if (error) throw error;
}

export async function removeAttachment(supabase: Client, attachment: Attachment) {
  const { error } = await supabase.from("cc_attachments").delete().eq("id", attachment.id);
  if (error) throw error;
  if (attachment.path) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.path]);
  }
}

/** Short-lived URL for previewing or downloading a private file. */
export async function attachmentUrl(supabase: Client, attachment: Attachment) {
  if (!attachment.path) return null;
  const { data, error } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.path, 60 * 60);
  if (error) return null;
  return data.signedUrl;
}

/* ------------------------------------------------------------------ *
 * Calendars, groups, invitations
 * ------------------------------------------------------------------ */

export async function insertCalendar(
  supabase: Client,
  input: { name: string; color: ColorKey; groupId?: string; privacy: Privacy },
) {
  const { data, error } = await supabase
    .from("cc_calendars")
    .insert({
      name: input.name.trim() || "Untitled calendar",
      kind: input.groupId ? "shared" : "personal",
      color: input.color,
      group_id: input.groupId ?? null,
      privacy: input.privacy,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function patchCalendar(
  supabase: Client,
  id: string,
  changes: Record<string, unknown>,
) {
  const { error } = await supabase.from("cc_calendars").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteCalendar(supabase: Client, id: string) {
  const { error } = await supabase.from("cc_calendars").delete().eq("id", id);
  if (error) throw error;
}

export async function insertGroup(
  supabase: Client,
  name: string,
  memberIds: string[],
  userId: string,
) {
  const { data, error } = await supabase
    .from("cc_groups")
    .insert({ name: name.trim() || "New group" })
    .select("id")
    .single();
  if (error) throw error;

  const groupId = data.id as string;
  await setGroupMembers(supabase, groupId, memberIds, userId);
  return groupId;
}

export async function setGroupMembers(
  supabase: Client,
  groupId: string,
  memberIds: string[],
  ownerId: string,
) {
  const wanted = [...new Set([ownerId, ...memberIds])];
  const { error: clearError } = await supabase
    .from("cc_group_members")
    .delete()
    .eq("group_id", groupId);
  if (clearError) throw clearError;

  const { error } = await supabase.from("cc_group_members").insert(
    wanted.map((user_id) => ({
      group_id: groupId,
      user_id,
      role: user_id === ownerId ? "owner" : "member",
    })),
  );
  if (error) throw error;
}

export async function patchGroup(
  supabase: Client,
  id: string,
  changes: Record<string, unknown>,
) {
  const { error } = await supabase.from("cc_groups").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteGroup(supabase: Client, id: string) {
  const { error } = await supabase.from("cc_groups").delete().eq("id", id);
  if (error) throw error;
}

export async function insertInvites(
  supabase: Client,
  rows: { email: string; token: string; groupId?: string; eventId?: string }[],
) {
  const { data, error } = await supabase
    .from("cc_invitations")
    .insert(
      rows.map((row) => ({
        email: row.email,
        token: row.token,
        group_id: row.groupId ?? null,
        event_id: row.eventId ?? null,
        status: "pending",
      })),
    )
    .select("id,email,token,invited_by,group_id,event_id,status,error,created_at");
  if (error) throw error;
  return ((data ?? []) as InviteRow[]).map(toInvite);
}

export async function patchInvite(
  supabase: Client,
  id: string,
  changes: Record<string, unknown>,
) {
  const { error } = await supabase.from("cc_invitations").update(changes).eq("id", id);
  if (error) throw error;
}

export async function deleteInvite(supabase: Client, id: string) {
  const { error } = await supabase.from("cc_invitations").delete().eq("id", id);
  if (error) throw error;
}

export async function acceptInvitation(supabase: Client, token: string) {
  const { data, error } = await supabase.rpc("cc_accept_invitation", { p_token: token });
  if (error) throw error;
  return data;
}
