"use client";

import { format } from "date-fns";
import { Send, StickyNote, X } from "lucide-react";
import { useState } from "react";
import { colorVar } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { Avatar, Button, controlClass } from "./ui";

/**
 * The notes pinned to this event — the other half of the handshake made in the
 * notes panel. Each side shows the other.
 *
 * Who may read a note is still the note's own business: a private note pinned
 * to a shared event stays private, so what appears here differs per person, on
 * purpose.
 */
export function EventNotes({ event }: { event: CalendarEvent }) {
  const store = useStore();
  const [text, setText] = useState("");
  const notes = store.notesFor(event.id);

  const calendar = store.calendarById(event.calendarId);
  // A note on a group event goes to that group, so everyone on it can read it.
  const groupId = calendar?.kind === "shared" ? calendar.groupId : undefined;

  const write = () => {
    const body = text.trim();
    if (!body) return;
    store.addNote({ body, groupId, color: groupId ? "teal" : "amber", eventId: event.id });
    setText("");
  };

  return (
    <div className="space-y-2">
      {notes.map((note) => {
        const author = store.personById(note.createdBy);
        const mine = note.createdBy === store.currentUserId;

        return (
          <div
            key={note.id}
            style={colorVar(note.color)}
            className="cc-tint cc-tint-border flex gap-2.5 rounded-xl border px-3 py-2"
          >
            {author && <Avatar person={author} size={22} className="mt-0.5" />}
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-ink-faint">
                {mine ? "You" : (author?.name ?? "Someone")} ·{" "}
                {format(new Date(note.createdAt), "d MMM, HH:mm")}
                {!note.groupId && " · private"}
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed whitespace-pre-wrap text-ink">
                {note.body}
              </p>
            </div>
            {mine && (
              <button
                type="button"
                title="Unpin from this event"
                onClick={() => store.unpinNoteFrom(note.id, event.id)}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint hover:bg-surface hover:text-ink"
              >
                <X size={12} />
              </button>
            )}
          </div>
        );
      })}

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              write();
            }
          }}
          rows={1}
          placeholder={
            groupId ? "Write a note for everyone on this event…" : "Write a note about this…"
          }
          className={`${controlClass} min-h-[38px] w-full resize-y text-[13px]`}
        />
        <Button
          variant="outline"
          onClick={write}
          disabled={!text.trim()}
          className="h-[38px] shrink-0"
          title="Add the note (⌘/Ctrl + Enter)"
        >
          <Send size={14} />
        </Button>
      </div>

      {notes.length === 0 && (
        <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-faint">
          <StickyNote size={12} className="mt-px shrink-0" />
          Notes written here appear on the shared paper too, and vice versa.
        </p>
      )}
    </div>
  );
}
