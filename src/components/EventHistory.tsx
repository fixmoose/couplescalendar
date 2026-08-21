"use client";

import { History } from "lucide-react";
import { useEffect, useState } from "react";
import { loadEventChanges } from "@/lib/db";
import { useStore } from "@/lib/store";
import type { CalendarEvent } from "@/lib/types";
import { Avatar } from "./ui";

/**
 * What has been changed on this event, and by whom.
 *
 * A shared event is editable by everybody on it, which is only comfortable if
 * it is also traceable: whoever moved dinner to nine is written down, not
 * guessed at. Recorded by the database, so it holds however the change was
 * made — the dialog, a drag on the grid, or a phone.
 */
export function EventHistory({ event }: { event: CalendarEvent }) {
  const { supabase, personById } = useStore();
  const [changes, setChanges] = useState<
    { id: string; actor_id: string | null; summary: string; created_at: string }[]
  >([]);

  const load = () => {
    void loadEventChanges(supabase, event.id)
      .then(setChanges)
      .catch(() => setChanges([]));
  };

  useEffect(load, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!changes.length) return null;

  return (
    <div className="space-y-1.5">
      <span className="mb-1.5 block text-[11px] font-semibold tracking-wide text-ink-faint uppercase">
        Changes
      </span>
      {changes.map((change) => {
        const when = new Date(change.created_at);
        const actor = change.actor_id ? personById(change.actor_id) : undefined;
        return (
          <div key={change.id} className="flex items-start gap-2 text-[12px]">
            <History size={12} className="mt-[3px] shrink-0 text-ink-faint" />
            <span className="min-w-0 flex-1 text-ink-muted">
              {change.summary}
              <span className="text-ink-faint">
                {" · "}
                {when.toLocaleString(undefined, {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </span>
            {actor && <Avatar person={actor} size={16} />}
          </div>
        );
      })}
    </div>
  );
}
