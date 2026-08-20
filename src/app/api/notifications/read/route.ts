import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Marks notifications read. Called by the service worker when somebody answers
 * a push, so the bell agrees with what they have already dealt with on the
 * lock screen.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const { ids } = (await request.json().catch(() => ({}))) as { ids?: string[] };
  if (!ids?.length) return NextResponse.json({ ok: true });

  // Row level security keeps this to the caller's own notifications.
  const { error } = await supabase
    .from("cc_notifications")
    .update({ read_at: new Date().toISOString() })
    .in("id", ids.slice(0, 50));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
