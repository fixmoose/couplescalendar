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
import { ME, SEED_CALENDARS, SEED_GROUPS, SEED_PEOPLE, seedEvents } from "./seed";
import type {
  Calendar,
  CalendarEvent,
  ColorKey,
  EventDraft,
  Group,
  Person,
} from "./types";

/**
 * Single source of truth for the calendar.
 *
 * Phase 1 keeps everything in the browser (localStorage) so the UI can be
 * tuned without a backend. The action surface below is intentionally the one
 * we want against Supabase — replacing the bodies with `CC_*` queries is the
 * whole of the migration.
 */

const STORAGE_KEY = "cc.state.v1";

/** Avatar colours handed out to newly invited people, in order. */
const COLOR_CYCLE: ColorKey[] = ["violet", "teal", "blue", "amber", "green", "rose"];

interface Data {
  people: Person[];
  groups: Group[];
  calendars: Calendar[];
  events: CalendarEvent[];
}

interface StoreValue extends Data {
  currentUserId: string;
  me: Person;
  ready: boolean;
  calendarById: (id: string) => Calendar | undefined;
  personById: (id: string) => Person | undefined;
  /** Events on calendars the sidebar currently shows. */
  visibleEvents: CalendarEvent[];
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
  };
}

function newId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function draftToEvent(draft: EventDraft, base: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: draft.id ?? newId("e"),
    calendarId: draft.calendarId,
    title: draft.title.trim() || "(no title)",
    notes: draft.notes.trim() || undefined,
    location: draft.location.trim() || undefined,
    start: draft.start.toISOString(),
    end: draft.end.toISOString(),
    allDay: draft.allDay,
    createdBy: ME,
    sharedWith: draft.sharedWith,
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
    const d = data ?? { people: [], groups: [], calendars: [], events: [] };

    const calendarById = (id: string) => d.calendars.find((c) => c.id === id);
    const personById = (id: string) => d.people.find((p) => p.id === id);

    const visibleIds = new Set(d.calendars.filter((c) => c.visible).map((c) => c.id));

    return {
      ...d,
      currentUserId: ME,
      me: d.people.find((p) => p.id === ME) ?? SEED_PEOPLE[0],
      ready: data !== null,
      calendarById,
      personById,
      visibleEvents: d.events.filter((e) => visibleIds.has(e.calendarId)),

      createEvent: (draft) => {
        const event = draftToEvent(draft);
        patch((s) => ({ ...s, events: [...s.events, event] }));
        return event;
      },

      updateEvent: (draft) =>
        mapEvents((e) =>
          e.id === draft.id
            ? draftToEvent(draft, { createdBy: e.createdBy, color: e.color })
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

      createCalendar: ({ name, color, groupId }) => {
        const calendar: Calendar = {
          id: newId("c"),
          name: name.trim() || "Untitled calendar",
          kind: groupId ? "shared" : "personal",
          color,
          ownerId: ME,
          groupId,
          visible: true,
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
          ownerId: ME,
          memberIds: Array.from(new Set([ME, ...memberIds])),
        };
        patch((s) => ({ ...s, groups: [...s.groups, group] }));
        return group;
      },

      setGroupMembers: (groupId, memberIds) =>
        patch((s) => ({
          ...s,
          groups: s.groups.map((g) =>
            g.id === groupId
              ? { ...g, memberIds: Array.from(new Set([ME, ...memberIds])) }
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
