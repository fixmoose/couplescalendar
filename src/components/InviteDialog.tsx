"use client";

import clsx from "clsx";
import { Check, CheckCircle2, Copy, Mail, Plus, Send, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";
import { publicUrl } from "@/lib/site";
import { useStore } from "@/lib/store";
import type { Invite } from "@/lib/types";
import { Button, Field, Modal, inputClass } from "./ui";

/** Accepts commas, semicolons, spaces or one address per line. */
function parseEmails(input: string) {
  return [...new Set(input.split(/[\s,;]+/).map((e) => e.trim()).filter((e) => e.includes("@")))];
}

function inviteLink(invite: Invite) {
  return `${publicUrl()}/join/${invite.token}`;
}

export function InviteDialog({ onClose }: { onClose: () => void }) {
  const store = useStore();
  const [raw, setRaw] = useState("");
  const [groupId, setGroupId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [asked, setAsked] = useState<string[]>([]);
  const [sent, setSent] = useState<Invite[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  /** Set once the mail is actually away; the window closes itself. */
  const [delivered, setDelivered] = useState<string[] | null>(null);
  const [makingGroup, setMakingGroup] = useState(false);
  const [groupName, setGroupName] = useState("");

  /** Create a group inline and select it, so the invite can carry it. */
  const createGroup = async () => {
    const created = await store.createGroup(groupName.trim(), []);
    if (created) setGroupId(created);
    setMakingGroup(false);
  };

  const emails = parseEmails(raw);
  const pending = store.invites.filter((i) => i.status !== "accepted");

  // Into a group that already has other people, the group decides first.
  const chosenGroup = store.groups.find((g) => g.id === groupId);
  const needsAgreement = Boolean(chosenGroup && chosenGroup.memberIds.length > 1);

  const send = async () => {
    if (!emails.length) return;
    setSending(true);
    setError(null);

    /*
     * Into a group with other people in it, the invitation is not ours to send
     * yet: everybody already there has to agree first, since the newcomer will
     * see when each of them is busy. The mail goes out on the last yes.
     */
    if (needsAgreement && chosenGroup) {
      for (const email of emails) {
        await store.proposeMember(chosenGroup.id, { email });
      }
      setSending(false);
      setAsked(emails);
      setRaw("");
      return;
    }

    const invites = await store.createInvites(emails, groupId || undefined);
    if (!invites.length) {
      setSending(false);
      setError("Those people are already on your calendar or already invited.");
      return;
    }

    try {
      const response = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invites: invites.map((i) => ({
            email: i.email,
            token: i.token,
            link: inviteLink(i),
          })),
          fromName: store.me.name,
          message,
        }),
      });
      const result = await response.json();

      if (response.ok) {
        for (const invite of invites) store.updateInvite(invite.id, { status: "sent" });
        setSending(false);
        setSent(invites);
        setRaw("");
        // Nothing left to do once it is away, so get out of the way — but show
        // the confirmation long enough to be read.
        setDelivered(invites.map((i) => i.email));
        window.setTimeout(onClose, 1400);
        return;
      } else {
        // 503 means mail is not configured yet — the invitation itself is
        // perfectly good, so it stays pending rather than being marked failed.
        const status = response.status === 503 ? "pending" : "failed";
        for (const invite of invites) {
          store.updateInvite(invite.id, { status, error: result.error });
        }
        setError(result.error ?? "Could not send the emails.");
      }
    } catch {
      for (const invite of invites) {
        store.updateInvite(invite.id, { status: "failed", error: "Network error" });
      }
      setError("Could not reach the mail service. The links below still work.");
    }

    setSending(false);
    setSent(invites);
    setRaw("");
  };

  const copy = (invite: Invite) => {
    void navigator.clipboard?.writeText(inviteLink(invite));
    setCopied(invite.id);
    window.setTimeout(() => setCopied(null), 1500);
  };

  if (asked.length) {
    return (
      <Modal title="Asked the group" onClose={onClose} width={440}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <Users size={28} className="text-brand" />
          <p className="text-[15px] font-medium text-ink">
            {asked.length === 1
              ? `Everyone in the group has been asked about ${asked[0]}`
              : `Everyone in the group has been asked about ${asked.length} people`}
          </p>
          <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
            The invitation goes out once they all agree — whoever joins will see
            when each of them is busy, so it is not one person&apos;s decision to
            make. You will hear either way.
          </p>
        </div>
      </Modal>
    );
  }

  if (delivered) {
    return (
      <Modal title="Invitation sent" onClose={onClose} width={420}>
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <CheckCircle2 size={30} className="text-[#3f9142]" />
          <p className="text-[15px] font-medium text-ink">
            {delivered.length === 1
              ? `Invitation sent to ${delivered[0]}`
              : `${delivered.length} invitations sent`}
          </p>
          <p className="text-[13px] text-ink-muted">
            They join your calendar as soon as they accept.
          </p>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      title="Invite people"
      onClose={onClose}
      width={520}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {sent ? "Done" : "Cancel"}
          </Button>
          <Button variant="primary" onClick={send} disabled={!emails.length || sending}>
            <Send size={15} />
            {sending
              ? "Sending…"
              : needsAgreement
                ? `Ask the group about ${emails.length || ""} ${emails.length === 1 ? "person" : "people"}`
                : `Send ${emails.length || ""} invite${emails.length === 1 ? "" : "s"}`}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Email addresses">
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={3}
            placeholder="ana@example.com, marko@example.com"
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1.5 text-[12px] text-ink-faint">
            Separate with commas, spaces or new lines. They get a link to create
            an account and land straight in your calendar.
          </p>
        </Field>

        <Field label="Add them to a group (optional)">
          {makingGroup ? (
            <div className="flex gap-2">
              <input
                autoFocus
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void createGroup();
                  }
                  if (e.key === "Escape") setMakingGroup(false);
                }}
                placeholder="Family, Us, Flatmates…"
                className={inputClass}
              />
              <Button
                variant="primary"
                onClick={() => void createGroup()}
                disabled={!groupName.trim()}
                className="shrink-0"
              >
                Create
              </Button>
              <Button
                variant="ghost"
                onClick={() => setMakingGroup(false)}
                className="shrink-0"
              >
                Cancel
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={groupId}
                onChange={(e) => setGroupId(e.target.value)}
                className={inputClass}
              >
                <option value="">No group for now</option>
                {store.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <Button
                variant="outline"
                onClick={() => {
                  setGroupName("");
                  setMakingGroup(true);
                }}
                title="Create a group"
                className="shrink-0"
              >
                <Plus size={15} /> New group
              </Button>
            </div>
          )}
          <p className="mt-1.5 text-[12px] text-ink-faint">
            A group is just a name for several people, so you can share with all
            of them at once. Everyone invited here joins it when they accept.
          </p>
        </Field>

        <Field label="Personal note (optional)">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Let's keep our plans in one place."
            className={`${inputClass} resize-none`}
          />
        </Field>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-[#d1443c]/30 bg-[#d1443c]/8 px-3 py-2 text-[12px] text-[#d1443c]">
            <TriangleAlert size={14} className="mt-px shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {pending.length > 0 && (
          <Field label="Invited">
            <div className="space-y-1.5">
              {pending.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-1.5"
                >
                  <Mail size={14} className="shrink-0 text-ink-faint" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-ink">
                    {invite.email}
                  </span>
                  <span
                    className={clsx(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                      invite.status === "sent" && "bg-[#3f9142]/12 text-[#3f9142]",
                      invite.status === "pending" && "bg-surface-2 text-ink-faint",
                      invite.status === "failed" && "bg-[#d1443c]/12 text-[#d1443c]",
                    )}
                  >
                    {invite.status}
                  </span>
                  <button
                    type="button"
                    onClick={() => copy(invite)}
                    title="Copy invite link"
                    className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink"
                  >
                    {copied === invite.id ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => store.cancelInvite(invite.id)}
                    className="text-[11px] text-ink-faint hover:text-[#d1443c]"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          </Field>
        )}
      </div>
    </Modal>
  );
}
