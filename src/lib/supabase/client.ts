"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client. Phase 2 uses it behind src/lib/store.tsx — the UI
 * keeps talking to useStore(), the store starts talking to CC_* tables.
 *
 * The project is shared with other apps, so every object this app touches is
 * prefixed CC_ and nothing here should ever select from an unprefixed table.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY — copy .env.local.example to .env.local.",
    );
  }
  return createBrowserClient(url, key);
}

export const supabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
