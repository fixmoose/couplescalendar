"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * One browser client for the whole app.
 *
 * This must be a singleton. Each client runs its own token refresh timer, and
 * two of them racing on the same refresh token means one presents a token the
 * other has already rotated — Supabase rejects it and the session is dropped.
 * That is what logging people out mid-session looks like.
 */
let client: SupabaseClient | undefined;

export function createClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — copy .env.local.example to .env.local.",
    );
  }

  client = createBrowserClient(url, key);
  return client;
}

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/**
 * Makes sure a usable session is in hand before a write goes out. Without it a
 * request can leave with no identity at all, and row level security refuses it
 * in a way that reads like a permissions bug rather than a lapsed login.
 */
export async function ensureSession(supabase: SupabaseClient) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const expiresAt = (session.expires_at ?? 0) * 1000;
  if (expiresAt && expiresAt - Date.now() < 60_000) {
    const { data, error } = await supabase.auth.refreshSession();
    if (error) return null;
    return data.session;
  }

  return session;
}
