import { NextResponse } from "next/server";
import { syncFeed, type FeedRow } from "@/lib/sync-feed";
import { createAdminClient } from "@/lib/supabase/server";

/**
 * Scheduled re-read of every feed that is due. Vercel Cron calls this (see
 * vercel.json) with the CRON_SECRET as a bearer token.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;

  // Fail loudly rather than open: without a secret in production this endpoint
  // would let anyone make the app re-fetch every subscribed calendar.
  if (!secret) {
    if (process.env.VERCEL_ENV === "production") {
      return NextResponse.json(
        { error: "CRON_SECRET is not set — refusing to run unprotected." },
        { status: 503 },
      );
    }
  } else {
    const authorised =
      request.headers.get("authorization") === `Bearer ${secret}` ||
      new URL(request.url).searchParams.get("key") === secret;
    if (!authorised) {
      return NextResponse.json({ error: "Not authorised." }, { status: 401 });
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("cc_calendar_feeds")
    .select("id,owner_id,calendar_id,name,url,mode,interval_minutes,last_synced_at")
    .eq("mode", "auto");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const due = (data ?? []).filter((feed) => {
    if (!feed.last_synced_at) return true;
    const next = new Date(feed.last_synced_at).getTime() + feed.interval_minutes * 60_000;
    return next <= now;
  });

  const results = [];
  for (const feed of due) {
    results.push({ feed: feed.name, ...(await syncFeed(admin, feed as FeedRow)) });
  }

  return NextResponse.json({ checked: data?.length ?? 0, synced: results.length, results });
}
