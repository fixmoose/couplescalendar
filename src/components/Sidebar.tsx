"use client";

import clsx from "clsx";
import {
  Check,
  Eye,
  Palette,
  Pencil,
  Plus,
  Settings2,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { colorVar, COLOR_KEYS, COLORS } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { Calendar, Group } from "@/lib/types";
import type { MenuItem, MenuState } from "./ContextMenu";
import { MiniMonth } from "./MiniMonth";
import { Avatar, Button } from "./ui";

function CalendarRow({
  calendar,
  onMenu,
}: {
  calendar: Calendar;
  onMenu: (e: React.MouseEvent, calendar: Calendar) => void;
}) {
  const { toggleCalendar, groups } = useStore();
  const group = groups.find((g) => g.id === calendar.groupId);

  return (
    <div
      className="group flex items-center gap-2.5 rounded-lg py-[5px] pr-1 pl-2 transition hover:bg-surface-2"
      onContextMenu={(e) => onMenu(e, calendar)}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={calendar.visible}
        aria-label={`Toggle ${calendar.name}`}
        onClick={() => toggleCalendar(calendar.id)}
        style={colorVar(calendar.color)}
        className={clsx(
          "flex h-[15px] w-[15px] shrink-0 items-center justify-center rounded-[5px] border-2 transition",
          calendar.visible
            ? "cc-solid border-[var(--c)]"
            : "border-[var(--c)] opacity-60 hover:opacity-100",
        )}
      >
        {calendar.visible && <Check size={10} strokeWidth={3.5} />}
      </button>

      <button
        type="button"
        onClick={() => toggleCalendar(calendar.id)}
        className={clsx(
          "min-w-0 flex-1 truncate text-left text-[13px] transition",
          calendar.visible ? "text-ink" : "text-ink-faint",
        )}
        title={group ? `${calendar.name} · ${group.name}` : calendar.name}
      >
        {calendar.name}
      </button>

      {group && (
        <div className="flex -space-x-1.5 pr-0.5">
          {group.memberIds.slice(0, 3).map((id) => (
            <MemberAvatar key={id} id={id} />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={(e) => onMenu(e, calendar)}
        aria-label={`${calendar.name} options`}
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface hover:text-ink"
      >
        <Settings2 size={13} />
      </button>
    </div>
  );
}

function MemberAvatar({ id }: { id: string }) {
  const { personById } = useStore();
  const person = personById(id);
  if (!person) return null;
  return (
    <Avatar
      person={person}
      size={17}
      className="ring-2 ring-[var(--surface)]"
    />
  );
}

function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between px-2 pt-4 pb-1">
      <span className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
        {children}
      </span>
      {action}
    </div>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="flex h-5 w-5 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-brand"
    >
      <Plus size={14} />
    </button>
  );
}

export function Sidebar({
  selected,
  onSelectDate,
  onNewEvent,
  onNewCalendar,
  onEditCalendar,
  onNewGroup,
  onEditGroup,
  openMenu,
}: {
  selected: Date;
  onSelectDate: (d: Date) => void;
  onNewEvent: () => void;
  onNewCalendar: (groupId?: string) => void;
  onEditCalendar: (calendar: Calendar) => void;
  onNewGroup: () => void;
  onEditGroup: (group: Group) => void;
  openMenu: (state: MenuState) => void;
}) {
  const store = useStore();
  const personal = store.calendars.filter((c) => c.kind === "personal");
  const shared = store.calendars.filter((c) => c.kind === "shared");

  const calendarMenu = (e: React.MouseEvent, calendar: Calendar) => {
    e.preventDefault();
    e.stopPropagation();
    const items: MenuItem[] = [
      {
        label: "Edit calendar",
        icon: <Pencil size={13} />,
        onSelect: () => onEditCalendar(calendar),
      },
      {
        label: "Show only this",
        icon: <Eye size={13} />,
        onSelect: () => store.showOnlyCalendar(calendar.id),
      },
      {
        kind: "submenu",
        label: "Colour",
        icon: <Palette size={13} />,
        items: COLOR_KEYS.map((key) => ({
          label: COLORS[key].label,
          checked: calendar.color === key,
          icon: (
            <span
              style={colorVar(key)}
              className="cc-dot h-2.5 w-2.5 rounded-full"
            />
          ),
          onSelect: () => store.setCalendarColor(calendar.id, key),
        })),
      },
      { kind: "separator" },
      {
        label: "Delete calendar",
        icon: <Trash2 size={13} />,
        danger: true,
        disabled: store.calendars.length === 1,
        onSelect: () => store.deleteCalendar(calendar.id),
      },
    ];
    openMenu({ x: e.clientX, y: e.clientY, items });
  };

  return (
    <aside className="flex h-full w-[268px] shrink-0 flex-col border-r border-line bg-surface">
      <div className="flex items-center gap-2.5 px-4 pt-4 pb-3">
        <Image
          src="/logo-mark.png"
          alt=""
          width={32}
          height={32}
          priority
          className="h-8 w-8"
        />
        <div className="text-[15px] leading-none font-bold tracking-tight text-ink">
          Couples<span className="text-brand">Calendar</span>
        </div>
      </div>

      <div className="px-4 pb-3">
        <Button
          variant="primary"
          onClick={onNewEvent}
          className="w-full justify-center"
        >
          <Plus size={16} /> New event
        </Button>
      </div>

      <div className="cc-scroll min-h-0 flex-1 overflow-y-auto px-3 pb-4">
        <MiniMonth
          selected={selected}
          events={store.visibleEvents}
          onSelect={onSelectDate}
        />

        <SectionTitle action={<AddButton label="New calendar" onClick={() => onNewCalendar()} />}>
          My calendars
        </SectionTitle>
        {personal.map((c) => (
          <CalendarRow key={c.id} calendar={c} onMenu={calendarMenu} />
        ))}

        <SectionTitle
          action={<AddButton label="New shared calendar" onClick={() => onNewCalendar(store.groups[0]?.id)} />}
        >
          Shared calendars
        </SectionTitle>
        {shared.length === 0 && (
          <p className="px-2 py-1 text-[12px] text-ink-faint">
            None yet — create one for a group.
          </p>
        )}
        {shared.map((c) => (
          <CalendarRow key={c.id} calendar={c} onMenu={calendarMenu} />
        ))}

        <SectionTitle action={<AddButton label="New group" onClick={onNewGroup} />}>
          My groups
        </SectionTitle>
        {store.groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onEditGroup(group)}
            className="flex w-full items-center gap-2.5 rounded-lg py-[6px] pr-2 pl-2 text-left transition hover:bg-surface-2"
          >
            <Users size={14} className="shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
              {group.name}
            </span>
            <span className="flex -space-x-1.5">
              {group.memberIds.slice(0, 4).map((id) => (
                <MemberAvatar key={id} id={id} />
              ))}
            </span>
          </button>
        ))}
      </div>
    </aside>
  );
}
