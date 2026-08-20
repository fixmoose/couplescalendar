"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Moon, Search, Sun } from "lucide-react";
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
}) {
  const { theme } = useTheme();
  const settings = useSettings();

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4">
      <IconButton
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back to where I was"
        title="Back to where I was"
        className="disabled:opacity-30"
      >
        <ArrowLeft size={17} />
      </IconButton>

      <Button variant="outline" onClick={onToday} className="px-3.5">
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

      <h1 className="ml-1 truncate text-[19px] font-semibold tracking-tight text-ink">
        {periodLabel(date, view)}
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

        <Segmented
          value={view}
          onChange={onView}
          options={[
            { value: "day", label: "Day", hint: "D" },
            { value: "week", label: "Week", hint: "W" },
            { value: "month", label: "Month", hint: "M" },
            { value: "agenda", label: "Agenda", hint: "A" },
          ]}
        />

        <NotificationsMenu onOpenEvent={onOpenEvent} />

        <IconButton
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
