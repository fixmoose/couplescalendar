import { NextResponse } from "next/server";

/**
 * Sends invitation emails through UniOne (US region).
 *
 * Set UNIONE_API_KEY (and optionally UNIONE_FROM_EMAIL / UNIONE_FROM_NAME) in
 * the environment. Without a key the route reports back cleanly so the UI can
 * fall back to copyable invite links instead of failing silently.
 */

const UNIONE_ENDPOINT =
  process.env.UNIONE_API_URL ?? "https://us1.unione.io/en/transactional/api/v1/email/send.json";

interface InvitePayload {
  email: string;
  token: string;
  link: string;
}

function html(fromName: string, link: string, message: string) {
  return `<!doctype html>
<html><body style="margin:0;background:#f6f6f7;font-family:-apple-system,Segoe UI,Roboto,sans-serif">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
             style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
        <tr><td>
          <h1 style="margin:0 0 8px;font-size:20px;color:#1a1a1e">
            ${escapeHtml(fromName)} invited you to CouplesCalendar
          </h1>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#6b6b76">
            Share plans, and keep the rest of your calendar private.
          </p>
          ${
            message
              ? `<p style="margin:0 0 20px;padding:12px 14px;border-left:3px solid #dc6b15;background:#fdf1e7;font-size:14px;line-height:1.5;color:#1a1a1e">${escapeHtml(message)}</p>`
              : ""
          }
          <a href="${link}" style="display:inline-block;background:#dc6b15;color:#fff;text-decoration:none;
             font-weight:600;font-size:15px;padding:12px 22px;border-radius:10px">Accept the invitation</a>
          <p style="margin:22px 0 0;font-size:12px;color:#9a9aa5">
            Or paste this link into your browser:<br>${link}
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.UNIONE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        error:
          "Email is not configured yet — set UNIONE_API_KEY. Share the invite links below in the meantime.",
      },
      { status: 503 },
    );
  }

  let body: { invites?: InvitePayload[]; fromName?: string; message?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const invites = (body.invites ?? []).filter((i) => i?.email?.includes("@"));
  if (!invites.length) {
    return NextResponse.json({ error: "No valid email addresses." }, { status: 400 });
  }

  const fromName = body.fromName?.slice(0, 80) || "A friend";
  const message = body.message?.slice(0, 500) ?? "";

  const results = await Promise.all(
    invites.map(async (invite) => {
      const response = await fetch(UNIONE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-KEY": apiKey,
        },
        body: JSON.stringify({
          message: {
            recipients: [{ email: invite.email }],
            template_engine: "simple",
            body: { html: html(fromName, invite.link, message) },
            subject: `${fromName} invited you to CouplesCalendar`,
            from_email: process.env.UNIONE_FROM_EMAIL ?? "no-reply@couplescalendar.app",
            from_name: process.env.UNIONE_FROM_NAME ?? "CouplesCalendar",
            track_links: 0,
            track_read: 0,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      return { email: invite.email, ok: response.ok, payload };
    }),
  );

  const failed = results.filter((r) => !r.ok);
  if (failed.length) {
    return NextResponse.json(
      {
        error: `UniOne rejected ${failed.length} of ${results.length} invitations.`,
        details: failed.map((f) => ({ email: f.email, response: f.payload })),
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: results.length });
}
