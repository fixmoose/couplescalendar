"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Moon, Search, Sun } from "lucide-react";
import { periodLabel } from "@/lib/date";
import { useSettings } from "@/lib/settings";
import { useTheme } from "@/lib/theme";
import type { CalendarEvent, CalendarView } from "@/lib/types";
import { AccountMenu } from "./AccountMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { Button, IconButton, Segmented, inputClass } from "./ui";

export function TopBar({
  date,
  view,
  query,
  onQuery,
  onPrev,
  onNext,
  onToday,
  onView,
  onOpenEvent,
  onSettings,
  onTrash,
  canGoBack,
  onBack,
  onMenu,
}: {
  date: Date;
  view: CalendarView;
  query: string;
  onQuery: (value: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onView: (view: CalendarView) => void;
  onOpenEvent: (event: CalendarEvent) => void;
  onSettings: () => void;
  onTrash: () => void;
  canGoBack: boolean;
  onBack: () => void;
  onMenu: () => void;
}) {
  const { theme } = useTheme();
  const settings = useSettings();

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
      <IconButton onClick={onMenu} aria-label="Menu" className="md:hidden">
        <Menu size={18} />
      </IconButton>

      <IconButton
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back to where I was"
        title="Back to where I was"
        className="hidden disabled:opacity-30 sm:inline-flex"
      >
        <ArrowLeft size={17} />
      </IconButton>

      <Button variant="outline" onClick={onToday} className="px-3 sm:px-3.5">
        Today
      </Button>

      <div className="flex items-center">
        <IconButton onClick={onPrev} aria-label="Previous">
          <ChevronLeft size={18} />
        </IconButton>
        <IconButton onClick={onNext} aria-label="Next">
          <ChevronRight size={18} />
        </IconButton>
      </div>

      <h1 className="ml-0.5 truncate text-[16px] font-semibold tracking-tight text-ink sm:ml-1 sm:text-[19px]">
        {view === "notes" ? "Notes" : periodLabel(date, view)}
      </h1>

      <div className="ml-auto flex items-center gap-2.5">
        <div className="relative hidden md:block">
          <Search
            size={14}
            className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-faint"
          />
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search events"
            className={`${inputClass} h-9 w-52 py-0 pl-8 text-[13px]`}
          />
        </div>

        {/* A phone has no room for four labels, so it gets a picker. */}
        <select
          value={view}
          onChange={(e) => onView(e.target.value as CalendarView)}
          aria-label="View"
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-[13px] text-ink sm:hidden"
        >
          <option value="day">Day</option>
          <option value="week">Week</option>
          <option value="month">Month</option>
          <option value="agenda">Agenda</option>
          <option value="notes">Notes</option>
        </select>

        <span className="hidden sm:block">
          <Segmented
            value={view}
            onChange={onView}
            options={[
              { value: "day", label: "Day", hint: "D" },
              { value: "week", label: "Week", hint: "W" },
              { value: "month", label: "Month", hint: "M" },
              { value: "agenda", label: "Agenda", hint: "A" },
              { value: "notes", label: "Notes", hint: "5" },
            ]}
          />
        </span>

        <NotificationsMenu onOpenEvent={onOpenEvent} />

        <IconButton
          className="hidden sm:inline-flex"
          onClick={() => settings.set("theme", theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
          title="Switch theme — more in Settings"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </IconButton>

        <AccountMenu onSettings={onSettings} onTrash={onTrash} />
      </div>
    </header>
  );
}
