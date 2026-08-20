"use client";

import type { CSSProperties } from "react";

/**
 * A colour per kind of interruption, so what has arrived is clear before a
 * word is read: a share is news, a reminder is a clock running down, urgent is
 * urgent. Each tone drives a rail, a tinted icon and a label — never the whole
 * card, which would make three of them shout at once.
 */
export type Tone = "share" | "note" | "invite" | "update" | "cancel" | "reminder" | "urgent";

const HUES: Record<Tone, { hex: string; label: string }> = {
  share: { hex: "#2f7ce0", label: "Shared with you" },
  note: { hex: "#0d9488", label: "Note pinned" },
  invite: { hex: "#7c5cf0", label: "Invitation" },
  update: { hex: "#c8930b", label: "Changed" },
  cancel: { hex: "#d1443c", label: "Cancelled" },
  reminder: { hex: "#dc6b15", label: "Reminder" },
  urgent: { hex: "#d1443c", label: "Urgent reminder" },
};

export const toneLabel = (tone: Tone) => HUES[tone].label;

/** Sets --c, which the cc-* helpers in globals.css mix everything else from. */
export const toneVar = (tone: Tone): CSSProperties =>
  ({ ["--c" as string]: HUES[tone].hex }) as CSSProperties;

/** Maps a stored notification kind onto a tone. */
export function toneForKind(kind: string): Tone {
  if (kind === "note") return "note";
  if (kind === "invite") return "invite";
  if (kind === "update") return "update";
  if (kind === "cancel") return "cancel";
  return "share";
}
