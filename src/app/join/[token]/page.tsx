import Image from "next/image";
import Link from "next/link";

/**
 * Where an invite link lands. Phase 2 turns this into the Supabase sign-up
 * flow: look the token up in CC_invitations, create the account, join the
 * group, mark the invite accepted.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <main className="flex min-h-full items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-8 text-center shadow-[var(--shadow-md)]">
        <Image
          src="/logo-mark.png"
          alt=""
          width={56}
          height={56}
          className="mx-auto h-14 w-14"
        />
        <h1 className="mt-4 text-[22px] font-bold tracking-tight text-ink">
          You have been invited
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          Someone wants to share plans with you on CouplesCalendar — the parts
          they choose, and nothing else.
        </p>

        <div className="mt-5 rounded-xl border border-line bg-surface-2 px-3 py-2 text-[12px] text-ink-faint">
          Invitation code
          <div className="font-mono text-[13px] break-all text-ink">{token}</div>
        </div>

        <p className="mt-5 text-[13px] text-ink-muted">
          Accounts open once the Supabase sign-up lands. Until then, this link
          confirms the invitation is valid.
        </p>

        <Link
          href="/"
          className="mt-6 inline-flex h-10 items-center justify-center rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-strong"
        >
          Open the calendar
        </Link>
      </div>
    </main>
  );
}
