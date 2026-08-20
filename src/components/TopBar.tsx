"use client";

import { ArrowLeft, ChevronLeft, ChevronRight, Menu, Moon, Search, StickyNote, Sun, X } from "lucide-react";
import { useState } from "react";
import { addDays, format } from "date-fns";
import { periodLabel } from "@/lib/date";
import { useIsMobile } from "@/lib/media";
import { useSettings } from "@/lib/settings";
import { useTheme } from "@/lib/theme";
import type { CalendarEvent, CalendarView } from "@/lib/types";
import { AccountMenu } from "./AccountMenu";
import { NotificationsMenu } from "./NotificationsMenu";
import { UpNextTicker } from "./UpNextTicker";
import { Button, IconButton, Segmented, inputClass } from "./ui";

/**
 * One row on a desktop, two on a phone.
 *
 * Everything here used to sit on a single line, which came to about 500px of
 * controls — wider than a phone, so the browser zoomed the whole app out to
 * fit and every screen was rendered at about three-quarters size. Two rows of
 * fewer, larger controls is the fix: the page fits the phone, so the phone
 * shows it at full size.
 */
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
  notesOpen,
  onNotes,
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
  notesOpen: boolean;
  onNotes: () => void;
}) {
  const { theme } = useTheme();
  const settings = useSettings();
  const isMobile = useIsMobile();
  const [searching, setSearching] = useState(false);

  if (isMobile) {
    // Week on a phone is three days; the title says which three.
    const title =
      view === "week"
        ? `${format(date, "d")} – ${format(addDays(date, 2), "d MMM")}`
        : view === "day"
          ? // "Thursday, 20 August 2026" truncates to nothing useful here.
            format(date, "EEE d MMM")
          : periodLabel(date, view);

    return (
      <header className="shrink-0 border-b border-line bg-surface">
        {/* Where am I, and has anything happened. */}
        <div className="flex h-14 items-center gap-1 px-2">
          <IconButton onClick={onMenu} aria-label="Menu" className="h-10 w-10">
            <Menu size={22} />
          </IconButton>

          <h1 className="min-w-0 flex-1 truncate px-1 text-[19px] font-semibold tracking-tight text-ink">
            {title}
          </h1>

          <IconButton
            onClick={() => setSearching((v) => !v)}
            active={searching}
            aria-label="Search events"
            className="h-10 w-10"
          >
            {searching ? <X size={20} /> : <Search size={20} />}
          </IconButton>

          <NotificationsMenu onOpenEvent={onOpenEvent} />
          <AccountMenu onSettings={onSettings} onTrash={onTrash} />
        </div>

        {/* Moving about. */}
        <div className="flex items-center gap-1.5 border-t border-line px-2 py-1.5">
          <Button variant="outline" onClick={onToday} className="h-9 px-3.5 text-[14px]">
            Today
          </Button>

          <IconButton onClick={onPrev} aria-label="Previous" className="h-10 w-10">
            <ChevronLeft size={22} />
          </IconButton>
          <IconButton onClick={onNext} aria-label="Next" className="h-10 w-10">
            <ChevronRight size={22} />
          </IconButton>

          <select
            value={view}
            onChange={(e) => onView(e.target.value as CalendarView)}
            aria-label="View"
            className="ml-auto h-9 rounded-lg border border-line bg-surface px-2 text-[14px] text-ink"
          >
            <option value="day">Day</option>
            <option value="week">3 days</option>
            <option value="month">Month</option>
            <option value="agenda">Agenda</option>
          </select>

          <IconButton
            onClick={onNotes}
            active={notesOpen}
            aria-label="Notes"
            className="h-10 w-10"
          >
            <StickyNote size={20} />
          </IconButton>
        </div>

        {searching && (
          <div className="border-t border-line px-2 py-2">
            <div className="relative">
              <Search
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint"
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => onQuery(e.target.value)}
                placeholder="Search events"
                className={`${inputClass} h-11 w-full py-0 pl-9 text-[15px]`}
              />
            </div>
          </div>
        )}
      </header>
    );
  }

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b border-line bg-surface px-3 sm:gap-3 sm:px-4">
      <IconButton
        onClick={onBack}
        disabled={!canGoBack}
        aria-label="Back to where I was"
        title="Back to where I was"
        className="disabled:opacity-30"
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
        {periodLabel(date, view)}
      </h1>

      <UpNextTicker />

      <div className="ml-auto flex min-w-0 items-center gap-2.5">
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

        <IconButton
          onClick={onNotes}
          active={notesOpen}
          aria-label="Notes"
          title="Notes — the shared piece of paper"
        >
          <StickyNote size={17} />
        </IconButton>

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
