import type { CalendarEvent, CalendarView } from "@/lib/types";

/** The interaction surface every view (month, week/day, agenda) is handed. */
export interface ViewHandlers {
  selectedId: string | null;
  /** Open the editor for an existing event. */
  onOpenEvent: (event: CalendarEvent) => void;
  /** Right-click on an event. */
  onEventMenu: (e: React.MouseEvent, event: CalendarEvent) => void;
  /** Click (or drag) on empty space — opens the editor pre-filled. */
  onCreate: (start: Date, end: Date, allDay: boolean) => void;
  /** Right-click on empty space. */
  onSlotMenu: (e: React.MouseEvent, at: Date, allDay: boolean) => void;
  /** Jump the whole app to a date/view. */
  onNavigate: (date: Date, view: CalendarView) => void;
  /** Files dropped on empty space — uploads, then opens the editor. */
  onDropFiles: (files: File[], start: Date, end: Date, allDay: boolean) => void;
  /** Files dropped straight onto an existing event. */
  onDropFilesOnEvent: (files: File[], event: CalendarEvent) => void;
}
