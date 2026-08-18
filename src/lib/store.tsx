"use client";

import type { SupabaseClient, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { canEdit, participantIds } from "./access";
import * as db from "./db";
import { createClient } from "./supabase/client";
import type {
  Attachment,
  Calendar,
  CalendarEvent,
  ColorKey,
  EventDraft,
  Importance,
  Invite,
  Person,
  Privacy,
} from "./types";

/**
 * Single source of truth for the calendar, backed by Supabase.
 *
 * Reads come from `cc_calendar_feed`, which has already masked anything the
 * viewer may only see as busy — the client never receives details it is not
 * entitled to. Writes are optimistic: local state changes immediately so
 * dragging stays smooth, the query runs behind it, and a failure reloads the
 * truth rather than leaving the UI lying about what was saved.
 *
 * Which calendars are ticked and whose busy times are hidden are per-device
 * view preferences, so they live in localStorage rather than the database.
 */

const VIEW_PREFS_KEY = "cc.view.v1";

interface ViewPrefs {
  hiddenCalendars: string[];
  busyHidden: string[];
}

function readPrefs(userId: string): ViewPrefs {
  try {
    const raw = window.localStorage.getItem(`${VIEW_PREFS_KEY}.${userId}`);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<ViewPrefs>;
      return {
        hiddenCalendars: parsed.hiddenCalendars ?? [],
        busyHidden: parsed.busyHidden ?? [],
      };
    }
  } catch {
    /* fall through to defaults */
  }
  return { hiddenCalendars: [], busyHidden: [] };
}

function writePrefs(userId: string, prefs: ViewPrefs) {
  try {
    window.localStorage.setItem(`${VIEW_PREFS_KEY}.${userId}`, JSON.stringify(prefs));
  } catch {
    /* private mode — preferences just will not persist */
  }
}

interface Data extends db.Workspace {
  busyHidden: string[];
}

interface StoreValue extends Data {
  currentUserId: string;
  me: Person;
  ready: boolean;
  /** Last write error, surfaced by the app shell. */
  error: string | null;
  clearError: () => void;
  refresh: () => Promise<void>;
  calendarById: (id: string) => Calendar | undefined;
  personById: (id: string) => Person | undefined;
  myCalendars: Calendar[];
  sharedCalendars: Calendar[];
  contacts: Person[];
  togglePersonBusy: (personId: string) => void;
  visibleEvents: CalendarEvent[];
  participantsOf: (event: CalendarEvent) => Person[];
  canEditEvent: (event: CalendarEvent) => boolean;
  sharedWithMe: { person: Person; count: number }[];
  iShareWith: { person: Person; count: number }[];
  /** How many items have travelled each way with one person. */
  trafficWith: (personId: string) => { from: number; to: number };
  itemsWith: (personId: string) => { fromThem: CalendarEvent[]; toThem: CalendarEvent[] };
  createEvent: (draft: EventDraft) => void;
  updateEvent: (draft: EventDraft & { id: string }) => void;
  rescheduleEvent: (id: string, start: Date, end: Date, allDay?: boolean) => void;
  deleteEvent: (id: string) => void;
  duplicateEvent: (id: string) => void;
  toggleEventShare: (eventId: string, personId: string) => void;
  moveEventToCalendar: (eventId: string, calendarId: string) => void;
  setEventColor: (eventId: string, color: ColorKey | undefined) => void;
  setEventPrivacy: (eventId: string, privacy: Privacy | undefined) => void;
  setEventImportance: (eventId: string, importance: Importance) => void;
  attachToEvent: (eventId: string, attachments: Attachment[]) => void;
  removeAttachment: (eventId: string, attachmentId: string) => void;
  toggleCalendar: (id: string) => void;
  showOnlyCalendar: (id: string) => void;
  createCalendar: (input: {
    name: string;
    color: ColorKey;
    groupId?: string;
    privacy?: Privacy;
  }) => void;
  renameCalendar: (id: string, name: string) => void;
  setCalendarColor: (id: string, color: ColorKey) => void;
  setCalendarPrivacy: (id: string, privacy: Privacy) => void;
  updateCalendarGroup: (id: string, groupId: string | undefined) => void;
  deleteCalendar: (id: string) => void;
  createGroup: (name: string, memberIds: string[], withCalendar?: boolean) => void;
  setGroupMembers: (groupId: string, memberIds: string[]) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  createInvites: (emails: string[], groupId?: string) => Promise<Invite[]>;
  updateInvite: (id: string, patch: Partial<Invite>) => void;
  cancelInvite: (id: string) => void;
  /** Exposed so attachment previews can mint signed URLs. */
  supabase: SupabaseClient;
}

const StoreContext = createContext<StoreValue | null>(null);

const EMPTY: Data = {
  people: [],
  groups: [],
  calendars: [],
  events: [],
  invites: [],
  busyHidden: [],
};

export function StoreProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const prefs = useRef<ViewPrefs>({ hiddenCalendars: [], busyHidden: [] });

  const load = useCallback(
    async (userId: string) => {
      prefs.current = readPrefs(userId);
      // Creates this app's profile and first calendar if they are missing.
      await db.bootstrapMe(supabase);
      const workspace = await db.loadWorkspace(
        supabase,
        new Set(prefs.current.hiddenCalendars),
      );
      setData({ ...workspace, busyHidden: prefs.current.busyHidden });
    },
    [supabase],
  );

  useEffect(() => {
    let alive = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!alive || !user) return;
      setUser(user);
      load(user.id).catch((e) => {
        setError(describe(e));
        setData(EMPTY);
      });
    });
    return () => {
      alive = false;
    };
  }, [supabase, load]);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      await load(user.id);
    } catch (e) {
      setError(describe(e));
    }
  }, [load, user]);

  /**
   * Applies the optimistic change, then runs the write. On failure the local
   * guess is discarded in favour of whatever the database actually holds.
   */
  const write = useCallback(
    (optimistic: (d: Data) => Data, query: () => Promise<unknown>) => {
      setData((current) => (current ? optimistic(current) : current));
      query().catch((e) => {
        setError(describe(e));
        void refresh();
      });
    },
    [refresh],
  );

  const savePrefs = useCallback(
    (next: Partial<ViewPrefs>) => {
      if (!user) return;
      prefs.current = { ...prefs.current, ...next };
      writePrefs(user.id, prefs.current);
    },
    [user],
  );

  const value = useMemo<StoreValue>(() => {
    const d = data ?? EMPTY;
    const userId = user?.id ?? "";
    const mapEvents =
      (fn: (e: CalendarEvent) => CalendarEvent) =>
      (s: Data): Data => ({ ...s, events: s.events.map(fn) });

    const calendarById = (id: string) => d.calendars.find((c) => c.id === id);
    const personById = (id: string) => d.people.find((p) => p.id === id);

    const myCalendars = d.calendars.filter(
      (c) => c.kind === "personal" && c.ownerId === userId,
    );
    const sharedCalendars = d.calendars.filter((c) => c.kind === "shared");
    const mine = new Set([...myCalendars, ...sharedCalendars].map((c) => c.id));
    const busyHidden = new Set(d.busyHidden);
    const contacts = d.people.filter((p) => p.id !== userId);

    // The feed already decided what may be seen; this applies only the
    // viewer's own show/hide switches.
    const visibleEvents = d.events.filter((event) => {
      if (event.masked) return !busyHidden.has(event.createdBy);
      const calendar = calendarById(event.calendarId);
      if (calendar && mine.has(calendar.id)) return calendar.visible;
      if (event.sharedWith.includes(userId)) return true;
      return !busyHidden.has(event.createdBy);
    });

    const me: Person =
      d.people.find((p) => p.id === userId) ??
      ({
        id: userId,
        name:
          (user?.user_metadata?.full_name as string) ??
          user?.email?.split("@")[0] ??
          "You",
        email: user?.email ?? "",
        avatarColor: "orange",
        avatarUrl: user?.user_metadata?.avatar_url as string | undefined,
      } satisfies Person);

    /** Does this event reach that person at all? */
    const reaches = (event: CalendarEvent, personId: string) => {
      if (event.sharedWith.includes(personId)) return true;
      const calendar = calendarById(event.calendarId);
      if (calendar?.kind !== "shared") return false;
      const group = d.groups.find((g) => g.id === calendar.groupId);
      return Boolean(group?.memberIds.includes(personId));
    };

    return {
      ...d,
      supabase,
      currentUserId: userId,
      me,
      ready: data !== null,
      error,
      clearError: () => setError(null),
      refresh,
      calendarById,
      personById,
      myCalendars,
      sharedCalendars,
      contacts,
      visibleEvents,

      participantsOf: (event) =>
        participantIds(event, calendarById(event.calendarId), d.groups)
          .map((id) => d.people.find((p) => p.id === id))
          .filter((p) => p !== undefined),

      canEditEvent: (event) =>
        !event.masked && canEdit(calendarById(event.calendarId), userId, d.groups),

      sharedWithMe: contacts
        .map((person) => ({
          person,
          count: d.events.filter((e) => !e.masked && e.createdBy === person.id).length,
        }))
        .filter((row) => row.count > 0),

      iShareWith: contacts
        .map((person) => ({
          person,
          count: d.events.filter(
            (e) => !e.masked && e.createdBy === userId && reaches(e, person.id),
          ).length,
        }))
        .filter((row) => row.count > 0),

      trafficWith: (personId) => ({
        from: d.events.filter((e) => !e.masked && e.createdBy === personId).length,
        to: d.events.filter(
          (e) => !e.masked && e.createdBy === userId && reaches(e, personId),
        ).length,
      }),

      itemsWith: (personId) => ({
        fromThem: d.events.filter((e) => !e.masked && e.createdBy === personId),
        toThem: d.events.filter(
          (e) => !e.masked && e.createdBy === userId && reaches(e, personId),
        ),
      }),

      /* ---------------- events ---------------- */

      createEvent: (draft) =>
        write(
          (s) => ({
            ...s,
            events: [
              ...s.events,
              {
                id: `tmp_${crypto.randomUUID()}`,
                calendarId: draft.calendarId,
                title: draft.title.trim() || "(no title)",
                notes: draft.notes || undefined,
                location: draft.location || undefined,
                start: draft.start.toISOString(),
                end: draft.end.toISOString(),
                allDay: draft.allDay,
                privacy: draft.privacy,
                importance: draft.importance,
                createdBy: userId,
                sharedWith: draft.sharedWith,
                attachments: draft.attachments,
              },
            ],
          }),
          async () => {
            await db.insertEvent(supabase, draft, userId);
            await refresh();
          },
        ),

      updateEvent: (draft) =>
        write(
          mapEvents((e) =>
            e.id === draft.id
              ? {
                  ...e,
                  calendarId: draft.calendarId,
                  title: draft.title.trim() || "(no title)",
                  notes: draft.notes || undefined,
                  location: draft.location || undefined,
                  start: draft.start.toISOString(),
                  end: draft.end.toISOString(),
                  allDay: draft.allDay,
                  privacy: draft.privacy,
                  importance: draft.importance,
                  sharedWith: draft.sharedWith,
                  attachments: draft.attachments,
                }
              : e,
          ),
          async () => {
            await db.updateEvent(supabase, draft.id, draft, userId);
            await refresh();
          },
        ),

      rescheduleEvent: (id, start, end, allDay) =>
        write(
          mapEvents((e) =>
            e.id === id
              ? {
                  ...e,
                  start: start.toISOString(),
                  end: end.toISOString(),
                  allDay: allDay ?? e.allDay,
                }
              : e,
          ),
          () =>
            db.patchEvent(supabase, id, {
              starts_at: start.toISOString(),
              ends_at: end.toISOString(),
              ...(allDay === undefined ? {} : { all_day: allDay }),
            }),
        ),

      deleteEvent: (id) =>
        write(
          (s) => ({ ...s, events: s.events.filter((e) => e.id !== id) }),
          () => db.deleteEvent(supabase, id),
        ),

      duplicateEvent: (id) =>
        write(
          (s) => s,
          async () => {
            await db.duplicateEvent(supabase, id, userId);
            await refresh();
          },
        ),

      toggleEventShare: (eventId, personId) => {
        const event = d.events.find((e) => e.id === eventId);
        if (!event) return;
        const next = event.sharedWith.includes(personId)
          ? event.sharedWith.filter((p) => p !== personId)
          : [...event.sharedWith, personId];
        write(
          mapEvents((e) => (e.id === eventId ? { ...e, sharedWith: next } : e)),
          () => db.setShares(supabase, eventId, next, userId),
        );
      },

      moveEventToCalendar: (eventId, calendarId) =>
        write(
          mapEvents((e) => (e.id === eventId ? { ...e, calendarId } : e)),
          () => db.patchEvent(supabase, eventId, { calendar_id: calendarId }),
        ),

      setEventColor: (eventId, color) =>
        write(
          mapEvents((e) => (e.id === eventId ? { ...e, color } : e)),
          () => db.patchEvent(supabase, eventId, { color: color ?? null }),
        ),

      setEventPrivacy: (eventId, privacy) =>
        write(
          mapEvents((e) => (e.id === eventId ? { ...e, privacy } : e)),
          () => db.patchEvent(supabase, eventId, { privacy: privacy ?? null }),
        ),

      setEventImportance: (eventId, importance) =>
        write(
          mapEvents((e) =>
            e.id === eventId
              ? { ...e, importance: importance === "urgent" ? "urgent" : undefined }
              : e,
          ),
          () => db.patchEvent(supabase, eventId, { importance }),
        ),

      attachToEvent: (eventId, attachments) =>
        write(
          mapEvents((e) =>
            e.id === eventId
              ? { ...e, attachments: [...(e.attachments ?? []), ...attachments] }
              : e,
          ),
          () => db.linkAttachments(supabase, eventId, attachments, userId),
        ),

      removeAttachment: (eventId, attachmentId) => {
        const attachment = d.events
          .find((e) => e.id === eventId)
          ?.attachments?.find((a) => a.id === attachmentId);
        write(
          mapEvents((e) =>
            e.id === eventId
              ? {
                  ...e,
                  attachments: (e.attachments ?? []).filter((a) => a.id !== attachmentId),
                }
              : e,
          ),
          () =>
            attachment ? db.removeAttachment(supabase, attachment) : Promise.resolve(),
        );
      },

      /* ---------------- calendars ---------------- */

      toggleCalendar: (id) => {
        const hidden = new Set(prefs.current.hiddenCalendars);
        if (hidden.has(id)) hidden.delete(id);
        else hidden.add(id);
        savePrefs({ hiddenCalendars: [...hidden] });
        setData((s) =>
          s
            ? {
                ...s,
                calendars: s.calendars.map((c) =>
                  c.id === id ? { ...c, visible: !hidden.has(c.id) } : c,
                ),
              }
            : s,
        );
      },

      showOnlyCalendar: (id) => {
        const hidden = d.calendars.filter((c) => c.id !== id).map((c) => c.id);
        savePrefs({ hiddenCalendars: hidden });
        setData((s) =>
          s
            ? { ...s, calendars: s.calendars.map((c) => ({ ...c, visible: c.id === id })) }
            : s,
        );
      },

      createCalendar: (input) =>
        write(
          (s) => s,
          async () => {
            await db.insertCalendar(supabase, {
              ...input,
              privacy: input.privacy ?? (input.groupId ? "details" : "busy"),
            });
            await refresh();
          },
        ),

      renameCalendar: (id, name) =>
        write(
          (s) => ({
            ...s,
            calendars: s.calendars.map((c) =>
              c.id === id ? { ...c, name: name.trim() || c.name } : c,
            ),
          }),
          () => db.patchCalendar(supabase, id, { name: name.trim() }),
        ),

      setCalendarColor: (id, color) =>
        write(
          (s) => ({
            ...s,
            calendars: s.calendars.map((c) => (c.id === id ? { ...c, color } : c)),
          }),
          () => db.patchCalendar(supabase, id, { color }),
        ),

      setCalendarPrivacy: (id, privacy) =>
        write(
          (s) => ({
            ...s,
            calendars: s.calendars.map((c) => (c.id === id ? { ...c, privacy } : c)),
          }),
          () => db.patchCalendar(supabase, id, { privacy }),
        ),

      updateCalendarGroup: (id, groupId) =>
        write(
          (s) => ({
            ...s,
            calendars: s.calendars.map((c) =>
              c.id === id ? { ...c, groupId, kind: groupId ? "shared" : "personal" } : c,
            ),
          }),
          async () => {
            await db.patchCalendar(supabase, id, {
              group_id: groupId ?? null,
              kind: groupId ? "shared" : "personal",
            });
            await refresh();
          },
        ),

      deleteCalendar: (id) =>
        write(
          (s) => ({
            ...s,
            calendars: s.calendars.filter((c) => c.id !== id),
            events: s.events.filter((e) => e.calendarId !== id),
          }),
          () => db.deleteCalendar(supabase, id),
        ),

      /* ---------------- groups ---------------- */

      createGroup: (name, memberIds, withCalendar = false) =>
        write(
          (s) => s,
          async () => {
            const groupId = await db.insertGroup(supabase, name, memberIds, userId);
            if (withCalendar) {
              await db.insertCalendar(supabase, {
                name: name.trim() || "Shared",
                color: "violet",
                groupId,
                privacy: "details",
              });
            }
            await refresh();
          },
        ),

      setGroupMembers: (groupId, memberIds) =>
        write(
          (s) => ({
            ...s,
            groups: s.groups.map((g) =>
              g.id === groupId
                ? { ...g, memberIds: [...new Set([userId, ...memberIds])] }
                : g,
            ),
          }),
          async () => {
            await db.setGroupMembers(supabase, groupId, memberIds, userId);
            await refresh();
          },
        ),

      renameGroup: (groupId, name) =>
        write(
          (s) => ({
            ...s,
            groups: s.groups.map((g) =>
              g.id === groupId ? { ...g, name: name.trim() || g.name } : g,
            ),
          }),
          () => db.patchGroup(supabase, groupId, { name: name.trim() }),
        ),

      deleteGroup: (groupId) =>
        write(
          (s) => ({ ...s, groups: s.groups.filter((g) => g.id !== groupId) }),
          async () => {
            await db.deleteGroup(supabase, groupId);
            await refresh();
          },
        ),

      /* ---------------- invitations ---------------- */

      createInvites: async (emails, groupId) => {
        const known = new Set(
          d.people
            .map((p) => p.email.toLowerCase())
            .concat(
              d.invites
                .filter((i) => i.status !== "failed")
                .map((i) => i.email.toLowerCase()),
            ),
        );
        const rows = [...new Set(emails.map((e) => e.trim().toLowerCase()))]
          .filter((email) => email.includes("@") && !known.has(email))
          .map((email) => ({
            email,
            token: crypto.randomUUID().replace(/-/g, ""),
            groupId,
          }));
        if (!rows.length) return [];

        try {
          const created = await db.insertInvites(supabase, rows);
          setData((s) => (s ? { ...s, invites: [...created, ...s.invites] } : s));
          return created;
        } catch (e) {
          setError(describe(e));
          return [];
        }
      },

      updateInvite: (id, patch) =>
        write(
          (s) => ({
            ...s,
            invites: s.invites.map((i) => (i.id === id ? { ...i, ...patch } : i)),
          }),
          () =>
            db.patchInvite(supabase, id, {
              ...(patch.status ? { status: patch.status } : {}),
              ...(patch.error !== undefined ? { error: patch.error ?? null } : {}),
            }),
        ),

      cancelInvite: (id) =>
        write(
          (s) => ({ ...s, invites: s.invites.filter((i) => i.id !== id) }),
          () => db.deleteInvite(supabase, id),
        ),

      togglePersonBusy: (personId) => {
        const hidden = new Set(prefs.current.busyHidden);
        if (hidden.has(personId)) hidden.delete(personId);
        else hidden.add(personId);
        savePrefs({ busyHidden: [...hidden] });
        setData((s) => (s ? { ...s, busyHidden: [...hidden] } : s));
      },
    };
  }, [data, error, refresh, savePrefs, supabase, user, write]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

/**
 * Turns a Postgres/PostgREST error into something a person can act on — while
 * still showing the underlying message, because a friendly summary alone made
 * a permissions problem impossible to diagnose.
 */
function describe(e: unknown) {
  if (typeof e !== "object" || !e) return "Something went wrong.";

  const error = e as { message?: string; code?: string; details?: string; hint?: string };
  const message = String(error.message ?? "");
  const code = error.code ? ` [${error.code}]` : "";
  const detail = [error.details, error.hint].filter(Boolean).join(" · ");

  if (
    message.includes("does not exist") ||
    message.includes("schema cache") ||
    message.includes("Could not find the table")
  ) {
    return `Database tables are missing — run supabase/schema.sql in the Supabase SQL editor.${code} ${message}`;
  }
  if (message.includes("row-level security")) {
    return `Refused by the database${code}: ${message}${detail ? ` (${detail})` : ""}`;
  }
  return `${message}${code}${detail ? ` — ${detail}` : ""}` || "Something went wrong.";
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
