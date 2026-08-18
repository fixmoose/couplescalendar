"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { accessFor, canEdit, maskEvent, participantIds } from "./access";
import { ME, SEED_CALENDARS, SEED_GROUPS, SEED_PEOPLE, seedEvents } from "./seed";
import type {
  Attachment,
  Calendar,
  CalendarEvent,
  ColorKey,
  EventDraft,
  Group,
  Invite,
  Person,
  Privacy,
} from "./types";

/**
 * Single source of truth for the calendar.
 *
 * Phase 1 keeps everything in the browser (localStorage) so the UI can be
 * tuned without a backend. The action surface below is intentionally the one
 * we want against Supabase — replacing the bodies with `CC_*` queries is the
 * whole of the migration.
 */

const STORAGE_KEY = "cc.state.v3"; // v3: attachments + invites

/** Avatar colours handed out to newly invited people, in order. */
const COLOR_CYCLE: ColorKey[] = ["violet", "teal", "blue", "amber", "green", "rose"];

interface Data {
  people: Person[];
  groups: Group[];
  calendars: Calendar[];
  events: CalendarEvent[];
  /** Whose busy blocks the viewer has switched off in the sidebar. */
  busyHidden: string[];
  /** People invited by email who have not signed up yet. */
  invites: Invite[];
  /**
   * Phase 1 has no auth, so "who am I" is state. The Preview-as control in the
   * top bar flips it, which is how you check what your group actually sees.
   */
  viewerId: string;
}

interface StoreValue extends Data {
  currentUserId: string;
  me: Person;
  ready: boolean;
  /** True while looking at the calendar through someone else's eyes. */
  previewing: boolean;
  viewAs: (personId: string) => void;
  calendarById: (id: string) => Calendar | undefined;
  personById: (id: string) => Person | undefined;
  /** The viewer's own calendars, then the group ones they belong to. */
  myCalendars: Calendar[];
  sharedCalendars: Calendar[];
  /** Everyone the viewer shares at least one group with. */
  contacts: Person[];
  togglePersonBusy: (personId: string) => void;
  /**
   * What the viewer is allowed to see, already filtered and — where they only
   * have busy access — stripped of every detail. Views never see more.
   */
  visibleEvents: CalendarEvent[];
  /** Everyone who can see this event in full. */
  participantsOf: (event: CalendarEvent) => Person[];
  canEditEvent: (event: CalendarEvent) => boolean;
  /** People who have sent something my way, with how many items. */
  sharedWithMe: { person: Person; count: number }[];
  /** People I have sent something to. */
  iShareWith: { person: Person; count: number }[];
  /** The two directions of traffic between me and one person. */
  itemsWith: (personId: string) => { fromThem: CalendarEvent[]; toThem: CalendarEvent[] };
  attachToEvent: (eventId: string, attachments: Attachment[]) => void;
  removeAttachment: (eventId: string, attachmentId: string) => void;
  createInvites: (emails: string[], groupId?: string) => Invite[];
  updateInvite: (id: string, patch: Partial<Invite>) => void;
  cancelInvite: (id: string) => void;
  setCalendarPrivacy: (id: string, privacy: Privacy) => void;
  setEventPrivacy: (eventId: string, privacy: Privacy | undefined) => void;
  createEvent: (draft: EventDraft) => CalendarEvent;
  updateEvent: (draft: EventDraft & { id: string }) => void;
  /** Drag / resize helper — keeps everything else on the event intact. */
  rescheduleEvent: (id: string, start: Date, end: Date, allDay?: boolean) => void;
  deleteEvent: (id: string) => void;
  duplicateEvent: (id: string) => void;
  toggleEventShare: (eventId: string, personId: string) => void;
  moveEventToCalendar: (eventId: string, calendarId: string) => void;
  setEventColor: (eventId: string, color: ColorKey | undefined) => void;
  toggleCalendar: (id: string) => void;
  showOnlyCalendar: (id: string) => void;
  setAllCalendars: (visible: boolean) => void;
  createCalendar: (input: {
    name: string;
    color: ColorKey;
    groupId?: string;
    privacy?: Privacy;
  }) => Calendar;
  renameCalendar: (id: string, name: string) => void;
  setCalendarColor: (id: string, color: ColorKey) => void;
  /** Attach a calendar to a group (or detach it back to personal). */
  updateCalendarGroup: (id: string, groupId: string | undefined) => void;
  deleteCalendar: (id: string) => void;
  /** Stand-in for a real invite: adds someone we can share with. */
  invitePerson: (email: string, name?: string) => Person;
  createGroup: (name: string, memberIds: string[]) => Group;
  setGroupMembers: (groupId: string, memberIds: string[]) => void;
  renameGroup: (groupId: string, name: string) => void;
  deleteGroup: (groupId: string) => void;
  resetDemoData: () => void;
}

const StoreContext = createContext<StoreValue | null>(null);

function freshData(): Data {
  return {
    people: SEED_PEOPLE,
    groups: SEED_GROUPS,
    calendars: SEED_CALENDARS,
    events: seedEvents(new Date()),
    busyHidden: [],
    invites: [],
    viewerId: ME,
  };
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function draftToEvent(
  draft: EventDraft,
  createdBy: string,
  base: Partial<CalendarEvent> = {},
): CalendarEvent {
  return {
    id: draft.id ?? newId("e"),
    calendarId: draft.calendarId,
    title: draft.title.trim() || "(no title)",
    notes: draft.notes.trim() || undefined,
    location: draft.location.trim() || undefined,
    start: draft.start.toISOString(),
    end: draft.end.toISOString(),
    allDay: draft.allDay,
    createdBy,
    sharedWith: draft.sharedWith,
    privacy: draft.privacy,
    attachments: draft.attachments,
    ...base,
  };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<Data | null>(null);

  // Hydrate on the client only: localStorage is an external system, and seed
  // data is relative to "today", which the server cannot know without causing
  // a hydration mismatch.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Data;
        if (parsed?.calendars?.length) {
          setData(parsed);
          return;
        }
      }
    } catch {
      /* corrupted payload — fall through to a fresh seed */
    }
    setData(freshData());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!data) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* quota or private mode — the UI keeps working in memory */
    }
  }, [data]);

  const patch = useCallback((fn: (d: Data) => Data) => {
    setData((current) => (current ? fn(current) : current));
  }, []);

  const mapEvents = useCallback(
    (fn: (e: CalendarEvent) => CalendarEvent) =>
      patch((d) => ({ ...d, events: d.events.map(fn) })),
    [patch],
  );

  const value = useMemo<StoreValue>(() => {
    const d = data ?? {
      people: [],
      groups: [],
      calendars: [],
      events: [],
      busyHidden: [],
      invites: [],
      viewerId: ME,
    };
    const viewerId = d.viewerId;

    const calendarById = (id: string) => d.calendars.find((c) => c.id === id);
    const personById = (id: string) => d.people.find((p) => p.id === id);

    const myCalendars = d.calendars.filter(
      (c) => c.kind === "personal" && c.ownerId === viewerId,
    );
    const sharedCalendars = d.calendars.filter(
      (c) =>
        c.kind === "shared" &&
        (c.ownerId === viewerId ||
          d.groups.some((g) => g.id === c.groupId && g.memberIds.includes(viewerId))),
    );
    const mine = new Set([...myCalendars, ...sharedCalendars].map((c) => c.id));
    const busyHidden = new Set(d.busyHidden);

    const contacts = d.people.filter(
      (p) =>
        p.id !== viewerId &&
        d.groups.some(
          (g) => g.memberIds.includes(viewerId) && g.memberIds.includes(p.id),
        ),
    );

    // One pass decides, per event, whether the viewer gets the whole thing, a
    // grey block, or nothing at all.
    const visibleEvents: CalendarEvent[] = [];
    for (const event of d.events) {
      const calendar = calendarById(event.calendarId);
      const access = accessFor(event, calendar, viewerId, d.groups);
      if (access === "none" || !calendar) continue;

      if (access === "busy") {
        if (busyHidden.has(calendar.ownerId)) continue;
        visibleEvents.push(maskEvent(event, calendar.ownerId));
        continue;
      }
      // Own and group calendars obey the sidebar checkboxes. Other people's
      // calendars obey their People toggle — except an event shared with me
      // personally, which always comes through.
      if (mine.has(calendar.id)) {
        if (!calendar.visible) continue;
      } else if (
        busyHidden.has(calendar.ownerId) &&
        !event.sharedWith.includes(viewerId)
      ) {
        continue;
      }
      visibleEvents.push(event);
    }

    return {
      ...d,
      currentUserId: viewerId,
      me: d.people.find((p) => p.id === viewerId) ?? SEED_PEOPLE[0],
      previewing: viewerId !== ME,
      ready: data !== null,
      calendarById,
      personById,
      myCalendars,
      sharedCalendars,
      contacts,
      visibleEvents,

      participantsOf: (event) => {
        const ids = participantIds(event, calendarById(event.calendarId), d.groups);
        return ids
          .map((id) => d.people.find((p) => p.id === id))
          .filter((p) => p !== undefined);
      },

      canEditEvent: (event) =>
        canEdit(calendarById(event.calendarId), viewerId, d.groups),

      sharedWithMe: contacts
        .map((person) => ({
          person,
          count: d.events.filter(
            (e) =>
              e.createdBy === person.id &&
              accessFor(e, calendarById(e.calendarId), viewerId, d.groups) === "full",
          ).length,
        }))
        .filter((row) => row.count > 0),

      iShareWith: contacts
        .map((person) => ({
          person,
          count: d.events.filter(
            (e) =>
              e.createdBy === viewerId &&
              accessFor(e, calendarById(e.calendarId), person.id, d.groups) === "full",
          ).length,
        }))
        .filter((row) => row.count > 0),

      itemsWith: (personId) => ({
        fromThem: d.events.filter(
          (e) =>
            e.createdBy === personId &&
            accessFor(e, calendarById(e.calendarId), viewerId, d.groups) === "full",
        ),
        toThem: d.events.filter(
          (e) =>
            e.createdBy === viewerId &&
            accessFor(e, calendarById(e.calendarId), personId, d.groups) === "full",
        ),
      }),

      attachToEvent: (eventId, attachments) =>
        mapEvents((e) =>
          e.id === eventId
            ? { ...e, attachments: [...(e.attachments ?? []), ...attachments] }
            : e,
        ),

      removeAttachment: (eventId, attachmentId) =>
        mapEvents((e) =>
          e.id === eventId
            ? {
                ...e,
                attachments: (e.attachments ?? []).filter((a) => a.id !== attachmentId),
              }
            : e,
        ),

      createInvites: (emails, groupId) => {
        const existing = new Set(
          d.people.map((p) => p.email.toLowerCase()).concat(
            d.invites
              .filter((i) => i.status !== "failed")
              .map((i) => i.email.toLowerCase()),
          ),
        );
        const invites: Invite[] = emails
          .map((email) => email.trim())
          .filter((email) => email.includes("@") && !existing.has(email.toLowerCase()))
          .map((email) => ({
            id: newId("i"),
            email,
            invitedBy: viewerId,
            groupId,
            status: "pending" as const,
            createdAt: new Date().toISOString(),
            token: `${newId("t")}${Math.random().toString(36).slice(2, 10)}`,
          }));
        if (invites.length) {
          patch((s) => ({ ...s, invites: [...s.invites, ...invites] }));
        }
        return invites;
      },

      updateInvite: (id, update) =>
        patch((s) => ({
          ...s,
          invites: s.invites.map((i) => (i.id === id ? { ...i, ...update } : i)),
        })),

      cancelInvite: (id) =>
        patch((s) => ({ ...s, invites: s.invites.filter((i) => i.id !== id) })),

      viewAs: (personId) => patch((s) => ({ ...s, viewerId: personId })),

      togglePersonBusy: (personId) =>
        patch((s) => ({
          ...s,
          busyHidden: s.busyHidden.includes(personId)
            ? s.busyHidden.filter((id) => id !== personId)
            : [...s.busyHidden, personId],
        })),

      setCalendarPrivacy: (id, privacy) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) => (c.id === id ? { ...c, privacy } : c)),
        })),

      setEventPrivacy: (eventId, privacy) =>
        mapEvents((e) => (e.id === eventId ? { ...e, privacy } : e)),

      createEvent: (draft) => {
        const event = draftToEvent(draft, viewerId);
        patch((s) => ({ ...s, events: [...s.events, event] }));
        return event;
      },

      updateEvent: (draft) =>
        mapEvents((e) =>
          e.id === draft.id
            ? draftToEvent(draft, e.createdBy, { color: e.color })
            : e,
        ),

      rescheduleEvent: (id, start, end, allDay) =>
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

      deleteEvent: (id) =>
        patch((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),

      duplicateEvent: (id) =>
        patch((s) => {
          const source = s.events.find((e) => e.id === id);
          if (!source) return s;
          return {
            ...s,
            events: [
              ...s.events,
              { ...source, id: newId("e"), title: `${source.title} (copy)` },
            ],
          };
        }),

      toggleEventShare: (eventId, personId) =>
        mapEvents((e) =>
          e.id === eventId
            ? {
                ...e,
                sharedWith: e.sharedWith.includes(personId)
                  ? e.sharedWith.filter((p) => p !== personId)
                  : [...e.sharedWith, personId],
              }
            : e,
        ),

      moveEventToCalendar: (eventId, calendarId) =>
        mapEvents((e) => (e.id === eventId ? { ...e, calendarId } : e)),

      setEventColor: (eventId, color) =>
        mapEvents((e) => (e.id === eventId ? { ...e, color } : e)),

      toggleCalendar: (id) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) =>
            c.id === id ? { ...c, visible: !c.visible } : c,
          ),
        })),

      showOnlyCalendar: (id) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) => ({ ...c, visible: c.id === id })),
        })),

      setAllCalendars: (visible) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) => ({ ...c, visible })),
        })),

      createCalendar: ({ name, color, groupId, privacy }) => {
        const calendar: Calendar = {
          id: newId("c"),
          name: name.trim() || "Untitled calendar",
          kind: groupId ? "shared" : "personal",
          color,
          ownerId: viewerId,
          groupId,
          visible: true,
          privacy: privacy ?? (groupId ? "details" : "busy"),
        };
        patch((s) => ({ ...s, calendars: [...s.calendars, calendar] }));
        return calendar;
      },

      renameCalendar: (id, name) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) =>
            c.id === id ? { ...c, name: name.trim() || c.name } : c,
          ),
        })),

      setCalendarColor: (id, color) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) => (c.id === id ? { ...c, color } : c)),
        })),

      updateCalendarGroup: (id, groupId) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.map((c) =>
            c.id === id
              ? { ...c, groupId, kind: groupId ? "shared" : "personal" }
              : c,
          ),
        })),

      deleteCalendar: (id) =>
        patch((s) => ({
          ...s,
          calendars: s.calendars.filter((c) => c.id !== id),
          events: s.events.filter((e) => e.calendarId !== id),
        })),

      invitePerson: (email, name) => {
        const existing = d.people.find(
          (p) => p.email.toLowerCase() === email.trim().toLowerCase(),
        );
        if (existing) return existing;
        const person: Person = {
          id: newId("u"),
          name: (name ?? email.split("@")[0]).trim() || "Guest",
          email: email.trim(),
          avatarColor: COLOR_CYCLE[d.people.length % COLOR_CYCLE.length],
        };
        patch((s) => ({ ...s, people: [...s.people, person] }));
        return person;
      },

      createGroup: (name, memberIds) => {
        const group: Group = {
          id: newId("g"),
          name: name.trim() || "New group",
          ownerId: viewerId,
          memberIds: Array.from(new Set([viewerId, ...memberIds])),
        };
        patch((s) => ({ ...s, groups: [...s.groups, group] }));
        return group;
      },

      setGroupMembers: (groupId, memberIds) =>
        patch((s) => ({
          ...s,
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, memberIds: Array.from(new Set([viewerId, ...memberIds])) }
              : g,
          ),
        })),

      renameGroup: (groupId, name) =>
        patch((s) => ({
          ...s,
          groups: s.groups.map((g) =>
            g.id === groupId ? { ...g, name: name.trim() || g.name } : g,
          ),
        })),

      deleteGroup: (groupId) =>
        patch((s) => ({
          ...s,
          groups: s.groups.filter((g) => g.id !== groupId),
          calendars: s.calendars.map((c) =>
            c.groupId === groupId ? { ...c, groupId: undefined, kind: "personal" } : c,
          ),
        })),

      resetDemoData: () => setData(freshData()),
    };
  }, [data, mapEvents, patch]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}
