import { addDays, startOfDay, startOfWeek } from "date-fns";
import { WEEK_STARTS_ON } from "./date";
import type { Calendar, CalendarEvent, Group, Person } from "./types";

export const ME = "u_dejan";

export const SEED_PEOPLE: Person[] = [
  { id: ME, name: "Dejan", email: "dejan@example.com", avatarColor: "orange" },
  { id: "u_ana", name: "Ana", email: "ana@example.com", avatarColor: "rose" },
  { id: "u_marko", name: "Marko", email: "marko@example.com", avatarColor: "blue" },
  { id: "u_lena", name: "Lena", email: "lena@example.com", avatarColor: "violet" },
];

export const SEED_GROUPS: Group[] = [
  { id: "g_us", name: "Us", ownerId: ME, memberIds: [ME, "u_ana"] },
  { id: "g_family", name: "Family", ownerId: ME, memberIds: [ME, "u_ana", "u_marko", "u_lena"] },
];

export const SEED_CALENDARS: Calendar[] = [
  { id: "c_me", name: "My calendar", kind: "personal", color: "orange", ownerId: ME, visible: true },
  { id: "c_work", name: "Work", kind: "personal", color: "blue", ownerId: ME, visible: true },
  { id: "c_us", name: "Us", kind: "shared", color: "rose", ownerId: ME, groupId: "g_us", visible: true },
  { id: "c_family", name: "Family", kind: "shared", color: "teal", ownerId: ME, groupId: "g_family", visible: true },
];

/** Demo content, always anchored to the week the app is opened in. */
export function seedEvents(now: Date): CalendarEvent[] {
  const monday = startOfWeek(now, { weekStartsOn: WEEK_STARTS_ON });
  const at = (dayOffset: number, hour: number, minute = 0) => {
    const d = addDays(monday, dayOffset);
    d.setHours(hour, minute, 0, 0);
    return d.toISOString();
  };
  const allDay = (dayOffset: number, days = 1) => {
    const s = startOfDay(addDays(monday, dayOffset));
    const e = startOfDay(addDays(monday, dayOffset + days - 1));
    e.setHours(23, 59, 59, 999);
    return { start: s.toISOString(), end: e.toISOString() };
  };

  const make = (
    id: string,
    calendarId: string,
    title: string,
    start: string,
    end: string,
    extra: Partial<CalendarEvent> = {},
  ): CalendarEvent => ({
    id,
    calendarId,
    title,
    start,
    end,
    allDay: false,
    createdBy: ME,
    sharedWith: [],
    ...extra,
  });

  return [
    make("e1", "c_work", "Standup", at(0, 9, 30), at(0, 9, 45)),
    make("e2", "c_work", "Design review", at(0, 11), at(0, 12), {
      location: "Meet",
    }),
    make("e3", "c_me", "Gym", at(0, 18, 30), at(0, 20)),
    make("e4", "c_us", "Dinner with Ana", at(1, 19, 30), at(1, 21, 30), {
      location: "Konoba Batelina",
      sharedWith: ["u_ana"],
    }),
    make("e5", "c_work", "Sprint planning", at(2, 10), at(2, 11, 30)),
    make("e6", "c_family", "Lena — dentist", at(2, 16), at(2, 17)),
    make("e7", "c_me", "Deep work", at(3, 9), at(3, 12)),
    make("e8", "c_work", "1:1 with Marko", at(3, 14), at(3, 14, 30), {
      sharedWith: ["u_marko"],
    }),
    make("e9", "c_us", "Cinema", at(4, 20), at(4, 22, 30), {
      notes: "Book seats in the middle row.",
      sharedWith: ["u_ana"],
    }),
    make("e10", "c_family", "Weekend at the coast", "", "", {
      allDay: true,
      ...allDay(5, 2),
    }),
    make("e11", "c_me", "Call parents", at(6, 11), at(6, 11, 45)),
    make("e12", "c_work", "Release cut", at(4, 15), at(4, 16)),
    make("e13", "c_us", "Anniversary", "", "", { allDay: true, ...allDay(3), color: "violet" }),
  ];
}
