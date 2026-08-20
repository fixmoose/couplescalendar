"use client";

import clsx from "clsx";
import { format, isToday, isYesterday } from "date-fns";
import { Check, Lock, Pencil, Pin, PinOff, Send, Trash2, Users } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { colorVar } from "@/lib/colors";
import { useStore } from "@/lib/store";
import type { Note } from "@/lib/types";
import { Avatar, Button, controlClass } from "./ui";

/**
 * A shared sheet of paper. Notes are kept as a stream — who wrote what, and
 * when — rather than one document people take turns overwriting, because two
 * people writing at once is the normal case here, not the exception.
 *
 * Which sheet you are on is the sharing model: your own, or one per group.
 */

function dayLabel(iso: string) {
  const d = new Date(iso);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "EEEE d MMMM");
}

function NoteCard({ note }: { note: Note }) {
  const store = useStore();
  const author = store.personById(note.createdBy);
  const mine = note.createdBy === store.currentUserId;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(note.body);

  return (
    <div className={clsx("flex gap-2.5", mine && "flex-row-reverse")}>
      {author ? (
        <Avatar
          person={author}
          size={28}
          status={store.presenceOf(author.id)}
          className="mt-1"
        />
      ) : (
        <span className="mt-1 h-7 w-7 shrink-0 rounded-full bg-surface-2" />
      )}

      <div className={clsx("max-w-[78%] min-w-0", mine && "text-right")}>
        <div
          className={clsx(
            "flex items-baseline gap-2 text-[11px] text-ink-faint",
            mine && "flex-row-reverse",
          )}
        >
          <span className="font-medium text-ink-muted">
            {mine ? "You" : (author?.name ?? "Someone")}
          </span>
          <span>{format(new Date(note.createdAt), "HH:mm")}</span>
          {note.updatedAt !== note.createdAt && <span>· edited</span>}
        </div>

        <div
          style={colorVar(note.color)}
          className={clsx(
            "group relative mt-1 rounded-2xl border px-3.5 py-2.5 text-left",
            mine
              ? "cc-tint cc-tint-border rounded-tr-sm"
              : "rounded-tl-sm border-line bg-surface",
            note.pinned && "ring-2 ring-[var(--c)]",
          )}
        >
          {editing ? (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={Math.max(2, draft.split("\n").length)}
                className={`${controlClass} w-full resize-none text-left text-[14px]`}
                autoFocus
              />
              <div className="flex justify-end gap-1.5">
                <Button
                  variant="ghost"
                  className="h-7 text-[12px]"
                  onClick={() => {
                    setDraft(note.body);
                    setEditing(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  className="h-7 text-[12px]"
                  onClick={() => {
                    if (draft.trim()) store.editNote(note.id, draft.trim());
                    setEditing(false);
                  }}
                >
                  <Check size={13} /> Save
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink">
              {note.body}
            </p>
          )}

          {note.pinned && (
            <Pin
              size={12}
              className="absolute -top-1.5 -left-1.5 rotate-[-20deg] text-[var(--c)]"
            />
          )}

          {mine && !editing && (
            <div
              className={clsx(
                "absolute -top-2 flex gap-0.5 rounded-lg border border-line bg-surface p-0.5 opacity-0 shadow-[var(--shadow-sm)] transition group-hover:opacity-100",
                mine ? "-left-2" : "-right-2",
              )}
            >
              <button
                type="button"
                title={note.pinned ? "Unpin" : "Pin to the top"}
                onClick={() => store.pinNote(note.id, !note.pinned)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink"
              >
                {note.pinned ? <PinOff size={12} /> : <Pin size={12} />}
              </button>
              <button
                type="button"
                title="Edit"
                onClick={() => setEditing(true)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-ink"
              >
                <Pencil size={12} />
              </button>
              <button
                type="button"
                title="Delete"
                onClick={() => store.removeNote(note.id)}
                className="flex h-6 w-6 items-center justify-center rounded-md text-ink-faint hover:bg-surface-2 hover:text-[#d1443c]"
              >
                <Trash2 size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function NotesView() {
  const store = useStore();
  const [board, setBoard] = useState<string>("me");
  const [text, setText] = useState("");
  const bottom = useRef<HTMLDivElement>(null);

  const boards = useMemo(
    () => [
      { id: "me", name: "Just me", icon: Lock, count: 0 },
      ...store.groups.map((g) => ({ id: g.id, name: g.name, icon: Users, count: 0 })),
    ],
    [store.groups],
  );

  const notes = useMemo(() => {
    const wanted = board === "me" ? undefined : board;
    return store.notes
      .filter((n) => n.groupId === wanted)
      .sort(
        (a, b) =>
          Number(b.pinned) - Number(a.pinned) ||
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [store.notes, board]);

  // A new note should bring the paper to where it landed.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [notes.length]);

  const write = () => {
    const body = text.trim();
    if (!body) return;
    store.addNote({
      body,
      groupId: board === "me" ? undefined : board,
      color: board === "me" ? "amber" : "teal",
    });
    setText("");
  };

  const group = store.groups.find((g) => g.id === board);

  return (
    <div className="flex min-h-0 flex-1 justify-center overflow-hidden bg-bg p-3 sm:p-6">
      {/* The paper: a sheet on the desk rather than another grid. */}
      <div className="flex min-h-0 w-full max-w-[680px] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-[var(--shadow-md)]">
        <div className="flex items-center gap-2 border-b border-line px-3 py-2.5">
          <div className="cc-scroll flex min-w-0 flex-1 gap-1 overflow-x-auto">
            {boards.map(({ id, name, icon: Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setBoard(id)}
                className={clsx(
                  "flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] transition",
                  board === id
                    ? "bg-brand-soft font-medium text-brand"
                    : "text-ink-muted hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={13} />
                {name}
              </button>
            ))}
          </div>
        </div>

        <p className="border-b border-line px-4 py-1.5 text-[11px] text-ink-faint">
          {group
            ? `Everyone in ${group.name} can read and add to this — ${group.memberIds.length} people.`
            : "Only you can see these."}
        </p>

        <div className="cc-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {notes.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
              <p className="text-[15px] font-medium text-ink">A blank piece of paper</p>
              <p className="max-w-[280px] text-[13px] leading-relaxed text-ink-muted">
                {group
                  ? `Write something for ${group.name} — a shopping thought, a reminder to each other, anything that is not an event.`
                  : "Write anything down. Nobody else sees this one."}
              </p>
            </div>
          )}

          {notes.map((note, i) => {
            const previous = notes[i - 1];
            const newDay =
              !previous ||
              new Date(previous.createdAt).toDateString() !==
                new Date(note.createdAt).toDateString();

            return (
              <div key={note.id} className="space-y-4">
                {newDay && (
                  <div className="flex items-center gap-3">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[11px] font-medium text-ink-faint">
                      {dayLabel(note.createdAt)}
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                )}
                <NoteCard note={note} />
              </div>
            );
          })}
          <div ref={bottom} />
        </div>

        <div className="flex items-end gap-2 border-t border-line p-3">
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
            placeholder={group ? `Write a note for ${group.name}…` : "Write a note…"}
            className={`${controlClass} max-h-[140px] min-h-[42px] w-full resize-y text-[14px]`}
          />
          <Button
            variant="primary"
            onClick={write}
            disabled={!text.trim()}
            className="h-[42px] shrink-0"
            title="Add the note (⌘/Ctrl + Enter)"
          >
            <Send size={15} />
          </Button>
        </div>
      </div>
    </div>
  );
}
