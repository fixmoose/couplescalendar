"use client";

import { format, formatDistanceToNow } from "date-fns";
import { Loader2, RotateCcw, Trash2, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { DeletedEvent } from "@/lib/types";
import { Button, Modal } from "./ui";

/**
 * Recently deleted. Deleting an event hides it rather than destroying it, so
 * something removed days ago can still come back — an undo that outlives the
 * session, and the tab.
 */
export function TrashDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [items, setItems] = useState<DeletedEvent[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = () => {
    void store
      .loadDeleted()
      .then(setItems)
      .catch(() => setItems([]));
  };

  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Modal
      title="Recently deleted"
      onClose={onClose}
      width={520}
      footer={
        <Button variant="primary" onClick={onClose}>
          Done
        </Button>
      }
    >
      {items === null && (
        <div className="flex justify-center py-10">
          <Loader2 size={20} className="animate-spin text-ink-faint" />
        </div>
      )}

      {items?.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Trash2 size={24} className="text-ink-faint" />
          <p className="text-[13px] text-ink-muted">Nothing deleted.</p>
        </div>
      )}

      {items && items.length > 0 && (
        <div className="space-y-1.5">
          {items.map((item) => {
            const start = new Date(item.start);
            return (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-lg border border-line px-3 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-ink">
                    {item.title}
                  </span>
                  <span className="block text-[11px] text-ink-faint">
                    {item.allDay
                      ? format(start, "EEE d MMM yyyy")
                      : format(start, "EEE d MMM yyyy · HH:mm")}
                    {" · deleted "}
                    {formatDistanceToNow(new Date(item.deletedAt))} ago
                  </span>
                </span>

                <Button
                  variant="outline"
                  className="h-8 shrink-0 text-[13px]"
                  disabled={busy === item.id}
                  onClick={() => {
                    setBusy(item.id);
                    store.restoreEvent(item.id);
                    window.setTimeout(() => {
                      setBusy(null);
                      load();
                    }, 600);
                  }}
                >
                  <RotateCcw size={14} /> Restore
                </Button>

                <button
                  type="button"
                  title="Delete for good"
                  onClick={() => {
                    store.purgeEvent(item.id);
                    setItems((current) =>
                      (current ?? []).filter((i) => i.id !== item.id),
                    );
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-[#d1443c]"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-faint">
        <TriangleAlert size={13} className="mt-px shrink-0" />
        Deleted events are kept for 30 days. Restoring one puts it back exactly
        where it was, with its files, list and guests.
      </p>
    </Modal>
  );
}
