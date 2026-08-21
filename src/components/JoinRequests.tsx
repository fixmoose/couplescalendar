"use client";

import clsx from "clsx";
import { Check, UserPlus, X } from "lucide-react";
import { useStore } from "@/lib/store";
import { Avatar } from "./ui";

/**
 * The questions a group has been asked, and the ones asked of you.
 *
 * Letting somebody into a group hands them a busy block for every event of
 * every member, and the whole of anything the group shares. That is everyone's
 * disclosure, so everyone answers: one refusal is enough to stop it, and
 * silence keeps it waiting rather than counting as a yes.
 */
export function JoinRequests() {
  const store = useStore();
  const waiting = store.pendingForMe;
  const mine = store.invitationsForMe;

  if (!waiting.length && !mine.length) return null;

  const nameOf = (request: (typeof waiting)[number]) =>
    request.inviteeId
      ? (store.personById(request.inviteeId)?.name ?? "Somebody")
      : (request.email ?? "Somebody");

  return (
    <div className="mb-3 space-y-2">
      {waiting.map((request) => {
        const group = store.groups.find((g) => g.id === request.groupId);
        const asker = store.personById(request.proposedBy);
        const others = (group?.memberIds.length ?? 1) - 1;
        const said = request.votes.filter((v) => v.approve).length;

        return (
          <div
            key={request.id}
            className="rounded-xl border border-brand/40 bg-brand-soft p-2.5"
          >
            <div className="flex items-start gap-2">
              <UserPlus size={14} className="mt-0.5 shrink-0 text-brand" />
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                <span className="font-medium">{asker?.name ?? "Somebody"}</span> wants
                to add <span className="font-medium">{nameOf(request)}</span> to{" "}
                {group?.name ?? "a group"}.
              </p>
            </div>

            <p className="mt-1 pl-6 text-[12px] leading-relaxed text-ink-muted">
              They would see when everybody here is busy, and everything the group
              shares.
            </p>

            <div className="mt-2 flex items-center gap-1.5 pl-6">
              <button
                type="button"
                onClick={() => void store.voteOnJoin(request.id, true)}
                className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-strong"
              >
                <Check size={12} /> Allow
              </button>
              <button
                type="button"
                onClick={() => void store.voteOnJoin(request.id, false)}
                className="flex items-center gap-1 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition hover:text-ink"
              >
                <X size={12} /> No
              </button>
              {others > 1 && (
                <span className="ml-auto text-[11px] text-ink-faint">
                  {said} of {others + 1} so far
                </span>
              )}
            </div>
          </div>
        );
      })}

      {mine.map((request) => {
        const group = store.groups.find((g) => g.id === request.groupId);
        const asker = store.personById(request.proposedBy);

        return (
          <div
            key={request.id}
            className="rounded-xl border border-line bg-surface p-2.5 shadow-[var(--shadow-sm)]"
          >
            <div className="flex items-start gap-2">
              {asker ? (
                <Avatar person={asker} size={18} />
              ) : (
                <UserPlus size={14} className="mt-0.5 text-ink-faint" />
              )}
              <p className="min-w-0 flex-1 text-[13px] leading-snug text-ink">
                {group?.name ?? "A group"} would like you to join.
              </p>
            </div>

            <p className="mt-1 pl-6 text-[12px] leading-relaxed text-ink-muted">
              Everyone there will see when you are busy, and you will see the same
              of them.
            </p>

            <div className="mt-2 flex items-center gap-1.5 pl-6">
              <button
                type="button"
                onClick={() => void store.answerGroupInvite(request.id, true)}
                className="flex items-center gap-1 rounded-lg bg-brand px-2.5 py-1.5 text-[12px] font-semibold text-white transition hover:bg-brand-strong"
              >
                <Check size={12} /> Join
              </button>
              <button
                type="button"
                onClick={() => void store.answerGroupInvite(request.id, false)}
                className={clsx(
                  "rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] font-medium text-ink-muted transition hover:text-ink",
                )}
              >
                No thanks
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
