import { NextResponse } from "next/server";
import { syncFeed, type FeedRow } from "@/lib/sync-feed";
import { createAdminClient, createClient } from "@/lib/supabase/server";

/** "Sync now" for one of your own feeds. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { feedId } = (await request.json().catch(() => ({}))) as { feedId?: string };
  if (!feedId) return NextResponse.json({ error: "No feed given." }, { status: 400 });

  // Read it as the user, so they can only ever sync their own.
  const { data: feed, error } = await supabase
    .from("cc_calendar_feeds")
    .select("id,owner_id,calendar_id,name,url,mode")
    .eq("id", feedId)
    .single();
  if (error || !feed) {
    return NextResponse.json({ error: "Feed not found." }, { status: 404 });
  }

  const result = await syncFeed(createAdminClient(), feed as FeedRow);
  return NextResponse.json(result, { status: result.ok ? 200 : 502 });
}
