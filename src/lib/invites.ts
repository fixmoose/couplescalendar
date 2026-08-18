"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import * as db from "./db";
import { publicUrl } from "./site";
import type { CalendarEvent, EventDraft, Invite } from "./types";

/**
 * Invites people who have no account yet to one event: a row in
 * cc_invitations carrying the event id, then an email with a calendar
 * attachment. Accepting the invitation grants the share — see
 * cc_accept_invitation() in the schema.
 */
export async function inviteToEvent(
  supabase: SupabaseClient,
  emails: string[],
  event: { id: string } & Pick<
    CalendarEvent | EventDraft,
    "title" | "location" | "notes" | "allDay"
  > & { start: Date; end: Date },
  from: { name: string; email: string },
): Promise<Invite[]> {
  const clean = [...new Set(emails.map((e) => e.trim().toLowerCase()))].filter((e) =>
    e.includes("@"),
  );
  if (!clean.length) return [];

  const created = await db.insertInvites(
    supabase,
    clean.map((email) => ({
      email,
      token: crypto.randomUUID().replace(/-/g, ""),
      eventId: event.id,
    })),
  );

  try {
    const response = await fetch("/api/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        invites: created.map((i) => ({
          email: i.email,
          token: i.token,
          link: `${publicUrl()}/join/${i.token}`,
        })),
        fromName: from.name,
        event: {
          title: event.title,
          start: event.start.toISOString(),
          end: event.end.toISOString(),
          allDay: event.allDay,
          location: event.location ?? undefined,
          notes: event.notes ?? undefined,
          organiser: from.name,
          organiserEmail: from.email,
        },
      }),
    });

    const status = response.ok ? "sent" : response.status === 503 ? "pending" : "failed";
    await Promise.all(
      created.map((i) => db.patchInvite(supabase, i.id, { status })),
    );
    return created.map((i) => ({ ...i, status }));
  } catch {
    return created;
  }
}
