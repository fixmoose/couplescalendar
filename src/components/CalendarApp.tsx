"use client";

import {
  addDays,
  addHours,
  addMonths,
  addWeeks,
  formatISO,
  startOfDay,
  startOfMonth,
} from "date-fns";
import {
  CalendarDays,
  CalendarPlus,
  Copy,
  CopyPlus,
  Eye,
  EyeOff,
  Lock,
  Palette,
  Pencil,
  Share2,
  SquarePen,
  Trash2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { colorVar, COLOR_KEYS, COLORS } from "@/lib/colors";
import { timeLabel, weekDays } from "@/lib/date";
import { useStore } from "@/lib/store";
import type { CalendarEvent, CalendarView, EventDraft, Calendar, Group } from "@/lib/types";
import { AgendaView } from "./AgendaView";
import { CalendarDialog } from "./CalendarDialog";
import { ContextMenu, type MenuItem, type MenuState } from "./ContextMenu";
import { EventDialog } from "./EventDialog";
import { GroupDialog } from "./GroupDialog";
import { MonthView } from "./MonthView";
import { Sidebar } from "./Sidebar";
import { TimeGridView } from "./TimeGridView";
import { TopBar } from "./TopBar";
import { PreviewBanner } from "./ViewAsMenu";
import { Avatar } from "./ui";
import type { ViewHandlers } from "./view-types";

type Dialog =
  | { kind: "event"; draft: EventDraft; event?: CalendarEvent }
  | { kind: "calendar"; calendar?: Calendar; groupId?: string }
  | { kind: "group"; group?: Group }
  | null;

const VIEWS: CalendarView[] = ["month", "week", "day", "agenda"];

/** The view and date live in the URL, so a reload (or a shared link) lands you back. */
function readUrl() {
  if (typeof window === "undefined") return { view: "week" as CalendarView, date: new Date() };
  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") as CalendarView | null;
  const raw = params.get("date");
  const parsed = raw ? new Date(`${raw}T00:00:00`) : null;
  return {
    view: view && VIEWS.includes(view) ? view : ("week" as CalendarView),
    date: parsed && !Number.isNaN(parsed.getTime()) ? parsed : new Date(),
  };
}

export function CalendarApp() {
  const store = useStore();
  const [date, setDate] = useState(() => readUrl().date);
  const [view, setView] = useState<CalendarView>(() => readUrl().view);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [menu, setMenu] = useState<MenuState | null>(null);

  const events = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return store.visibleEvents;
    return store.visibleEvents.filter((e) =>
      [e.title, e.location, e.notes].some((field) =>
        field?.toLowerCase().includes(q),
      ),
    );
  }, [store.visibleEvents, query]);

  const defaultCalendarId =
    store.myCalendars.find((c) => c.visible)?.id ??
    store.myCalendars[0]?.id ??
    store.sharedCalendars[0]?.id ??
    "";

  const openEventDialog = useCallback(
    (start: Date, end: Date, allDay: boolean) =>
      setDialog({
        kind: "event",
        draft: {
          calendarId: defaultCalendarId,
          title: "",
          notes: "",
          location: "",
          start,
          end,
          allDay,
          sharedWith: [],
        },
      }),
    [defaultCalendarId],
  );

  const editEvent = useCallback((event: CalendarEvent) => {
    if (event.masked) return; // nothing to open — we hold no details
    setSelectedId(event.id);
    setDialog({
      kind: "event",
      event,
      draft: {
        id: event.id,
        calendarId: event.calendarId,
        title: event.title,
        notes: event.notes ?? "",
        location: event.location ?? "",
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        sharedWith: event.sharedWith,
        privacy: event.privacy,
      },
    });
  }, []);

  /** People I share a group with — the audience for per-event sharing. */
  const contacts = useMemo(() => {
    const ids = new Set(
      store.groups
        .filter((g) => g.memberIds.includes(store.currentUserId))
        .flatMap((g) => g.memberIds),
    );
    ids.delete(store.currentUserId);
    return [...ids].map((id) => store.personById(id)).filter((p) => p !== undefined);
  }, [store]);

  /** Take a copy of someone else's event onto my own calendar. */
  const copyToMyCalendar = useCallback(
    (event: CalendarEvent) => {
      const target = store.myCalendars.find((c) => c.visible) ?? store.myCalendars[0];
      if (!target) return;
      store.createEvent({
        calendarId: target.id,
        title: event.title,
        notes: event.notes ?? "",
        location: event.location ?? "",
        start: new Date(event.start),
        end: new Date(event.end),
        allDay: event.allDay,
        sharedWith: [],
      });
    },
    [store],
  );

  const eventMenu = useCallback(
    (e: React.MouseEvent, event: CalendarEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedId(event.id);

      // A busy block carries no details, so there is nothing to act on.
      if (event.masked) {
        const owner = store.personById(event.createdBy);
        setMenu({
          x: e.clientX,
          y: e.clientY,
          items: [
            { kind: "heading", label: `${owner?.name ?? "Someone"} is busy` },
            {
              label: "Details are private",
              icon: <EyeOff size={13} />,
              disabled: true,
              onSelect: () => {},
            },
            { kind: "separator" },
            {
              label: "Hide their busy times",
              icon: <EyeOff size={13} />,
              onSelect: () => store.togglePersonBusy(event.createdBy),
            },
          ],
        });
        return;
      }

      const editable = store.canEditEvent(event);
      const items: MenuItem[] = [
        {
          label: editable ? "Open" : "Open (read only)",
          icon: <SquarePen size={13} />,
          onSelect: () => editEvent(event),
        },
        {
          label: "Duplicate",
          icon: <Copy size={13} />,
          onSelect: () => store.duplicateEvent(event.id),
        },
        ...(editable
          ? []
          : [
              {
                label: "Copy to my calendar",
                icon: <CopyPlus size={13} />,
                onSelect: () => copyToMyCalendar(event),
              } as MenuItem,
            ]),
        { kind: "separator" },
        { kind: "heading", label: "Share" },
        {
          kind: "submenu",
          label: "Add to their calendar",
          icon: <Share2 size={13} />,
          items:
            contacts.length > 0
              ? contacts.map((person) => ({
                  label: person.name,
                  checked: event.sharedWith.includes(person.id),
                  disabled: !editable,
                  icon: <Avatar person={person} size={16} />,
                  onSelect: () => store.toggleEventShare(event.id, person.id),
                }))
              : [
                  {
                    label: "No one to share with yet",
                    disabled: true,
                    onSelect: () => {},
                  },
                ],
        },
        {
          kind: "submenu",
          label: "Who else can see it",
          icon: <Eye size={13} />,
          items: [
            {
              label: "Calendar default",
              checked: !event.privacy,
              disabled: !editable,
              onSelect: () => store.setEventPrivacy(event.id, undefined),
            },
            { kind: "separator" },
            {
              label: "Show details",
              icon: <Eye size={13} />,
              checked: event.privacy === "details",
              disabled: !editable,
              onSelect: () => store.setEventPrivacy(event.id, "details"),
            },
            {
              label: "Busy only",
              icon: <EyeOff size={13} />,
              checked: event.privacy === "busy",
              disabled: !editable,
              onSelect: () => store.setEventPrivacy(event.id, "busy"),
            },
            {
              label: "Hidden",
              icon: <Lock size={13} />,
              checked: event.privacy === "hidden",
              disabled: !editable,
              onSelect: () => store.setEventPrivacy(event.id, "hidden"),
            },
          ],
        },
        {
          kind: "submenu",
          label: "Move to calendar",
          icon: <CalendarDays size={13} />,
          items: [...store.myCalendars, ...store.sharedCalendars].map((c) => ({
            label: c.name,
            checked: c.id === event.calendarId,
            disabled: !editable,
            icon: (
              <span style={colorVar(c.color)} className="cc-dot h-2.5 w-2.5 rounded-full" />
            ),
            onSelect: () => store.moveEventToCalendar(event.id, c.id),
          })),
        },
        {
          kind: "submenu",
          label: "Colour",
          icon: <Palette size={13} />,
          items: [
            {
              label: "Calendar colour",
              checked: !event.color,
              onSelect: () => store.setEventColor(event.id, undefined),
            },
            { kind: "separator" },
            ...COLOR_KEYS.map((key) => ({
              label: COLORS[key].label,
              checked: event.color === key,
              disabled: !editable,
              icon: (
                <span style={colorVar(key)} className="cc-dot h-2.5 w-2.5 rounded-full" />
              ),
              onSelect: () => store.setEventColor(event.id, key),
            })),
          ],
        },
        { kind: "separator" },
        {
          label: "Delete",
          icon: <Trash2 size={13} />,
          danger: true,
          disabled: !editable,
          onSelect: () => store.deleteEvent(event.id),
        },
      ];

      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [contacts, copyToMyCalendar, editEvent, store],
  );

  const slotMenu = useCallback(
    (e: React.MouseEvent, at: Date, allDay: boolean) => {
      e.preventDefault();
      const items: MenuItem[] = [
        {
          label: allDay ? "New all-day event" : `New event at ${timeLabel(at)}`,
          icon: <CalendarPlus size={13} />,
          onSelect: () =>
            allDay
              ? openEventDialog(startOfDay(at), startOfDay(at), true)
              : openEventDialog(at, addHours(at, 1), false),
        },
        {
          label: "New all-day event",
          icon: <CalendarDays size={13} />,
          onSelect: () => openEventDialog(startOfDay(at), startOfDay(at), true),
        },
        { kind: "separator" },
        {
          label: "Go to this day",
          icon: <CalendarDays size={13} />,
          onSelect: () => {
            setDate(at);
            setView("day");
          },
        },
        {
          label: "New calendar…",
          icon: <Pencil size={13} />,
          onSelect: () => setDialog({ kind: "calendar" }),
        },
        {
          label: "New group…",
          icon: <Users size={13} />,
          onSelect: () => setDialog({ kind: "group" }),
        },
      ];
      setMenu({ x: e.clientX, y: e.clientY, items });
    },
    [openEventDialog],
  );

  const handlers: ViewHandlers = useMemo(
    () => ({
      selectedId,
      onOpenEvent: editEvent,
      onEventMenu: eventMenu,
      onCreate: openEventDialog,
      onSlotMenu: slotMenu,
      onNavigate: (next, nextView) => {
        setDate(next);
        setView(nextView);
      },
    }),
    [editEvent, eventMenu, openEventDialog, selectedId, slotMenu],
  );

  const step = useCallback(
    (direction: 1 | -1) =>
      setDate((current) => {
        if (view === "month") return addMonths(startOfMonth(current), direction);
        if (view === "week") return addWeeks(current, direction);
        if (view === "day") return addDays(current, direction);
        return addDays(current, direction * 7);
      }),
    [view],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    params.set("view", view);
    params.set("date", formatISO(date, { representation: "date" }));
    window.history.replaceState(null, "", `?${params.toString()}`);
  }, [view, date]);

  // Keyboard shortcuts, Google-Calendar style.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        dialog ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        target?.closest("input, textarea, select, [contenteditable]")
      ) {
        return;
      }
      const key = e.key.toLowerCase();
      if (key === "t") setDate(new Date());
      else if (key === "d" || key === "1") setView("day");
      else if (key === "w" || key === "2") setView("week");
      else if (key === "m" || key === "3") setView("month");
      else if (key === "a" || key === "4") setView("agenda");
      else if (key === "n" || key === "c") {
        const start = new Date(date);
        start.setHours(9, 0, 0, 0);
        openEventDialog(start, addHours(start, 1), false);
      } else if (key === "arrowleft" || key === "k") step(-1);
      else if (key === "arrowright" || key === "j") step(1);
      else if (key === "escape") setSelectedId(null);
      else return;
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [date, dialog, openEventDialog, step]);

  if (!store.ready) {
    return (
      <div className="flex h-full items-center justify-center bg-bg text-[13px] text-ink-faint">
        Loading your calendar…
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-bg">
      <Sidebar
        selected={date}
        onSelectDate={(d) => setDate(d)}
        onNewEvent={() => {
          const start = new Date(date);
          start.setHours(9, 0, 0, 0);
          openEventDialog(start, addHours(start, 1), false);
        }}
        onNewCalendar={(groupId) => setDialog({ kind: "calendar", groupId })}
        onEditCalendar={(calendar) => setDialog({ kind: "calendar", calendar })}
        onNewGroup={() => setDialog({ kind: "group" })}
        onEditGroup={(group) => setDialog({ kind: "group", group })}
        openMenu={setMenu}
      />

      <main className="flex min-w-0 flex-1 flex-col">
        <PreviewBanner />
        <TopBar
          date={date}
          view={view}
          query={query}
          onQuery={setQuery}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onToday={() => setDate(new Date())}
          onView={setView}
        />

        {view === "month" && (
          <MonthView date={date} events={events} handlers={handlers} />
        )}
        {view === "week" && (
          <TimeGridView days={weekDays(date)} events={events} handlers={handlers} />
        )}
        {view === "day" && (
          <TimeGridView days={[date]} events={events} handlers={handlers} />
        )}
        {view === "agenda" && (
          <AgendaView date={date} events={events} handlers={handlers} />
        )}
      </main>

      {menu && <ContextMenu state={menu} onClose={() => setMenu(null)} />}

      {dialog?.kind === "event" && (
        <EventDialog
          draft={dialog.draft}
          event={dialog.event}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "calendar" && (
        <CalendarDialog
          calendar={dialog.calendar}
          defaultGroupId={dialog.groupId}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog?.kind === "group" && (
        <GroupDialog group={dialog.group} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
