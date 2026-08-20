import { NextResponse } from "next/server";

/**
 * Client-side failures, written to the server log so they can be read from the
 * deployment rather than copied off somebody's screen.
 *
 * Deliberately small: what was attempted, what the database said, and whether
 * a session was present. No event titles, notes or addresses.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ ok: false }, { status: 400 });

  const { operation, code, message, detail, hasSession, userId, payload } = body as Record<
    string,
    unknown
  >;

  console.error(
    "[cc-client-error]",
    JSON.stringify({
      operation,
      code,
      message: String(message ?? "").slice(0, 300),
      detail: String(detail ?? "").slice(0, 200),
      hasSession,
      userId: typeof userId === "string" ? userId.slice(0, 8) : null,
      payload,
      at: new Date().toISOString(),
    }),
  );

  return NextResponse.json({ ok: true });
}
