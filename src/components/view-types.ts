import type { CalendarEvent, CalendarView } from "@/lib/types";

/** The interaction surface every view (month, week/day, agenda) is handed. */
export interface ViewHandlers {
  selectedId: string | null;
  /** Open the editor for an existing event. */
  onOpenEvent: (event: CalendarEvent) => void;
  /** Right-click on an event. */
  onEventMenu: (e: React.MouseEvent, event: CalendarEvent) => void;
  /** Drag, double-click or the right-click menu — opens the editor pre-filled. */
  onCreate: (start: Date, end: Date, allDay: boolean) => void;
  /** Plain left click on empty space: selects the slot, creates nothing. */
  onSelectSlot: (start: Date, end: Date, allDay: boolean) => void;
  /** The slot the viewer has picked, so views can highlight it. */
  selectedSlot: { start: string; end: string } | null;
  /** Right-click on empty space. */
  onSlotMenu: (e: React.MouseEvent, at: Date, allDay: boolean) => void;
  /** Jump the whole app to a date/view. */
  onNavigate: (date: Date, view: CalendarView) => void;
  /** Files dropped on empty space — uploads, then opens the editor. */
  onDropFiles: (files: File[], start: Date, end: Date, allDay: boolean) => void;
  /** Files dropped straight onto an existing event. */
  onDropFilesOnEvent: (files: File[], event: CalendarEvent) => void;
}
