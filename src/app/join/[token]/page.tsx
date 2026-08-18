import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AcceptInvite } from "@/components/AcceptInvite";
import { createClient } from "@/lib/supabase/server";

/**
 * Where an invite link lands. Signed-in visitors redeem it immediately;
 * everyone else is sent to sign up and comes back here afterwards.
 */
export default async function JoinPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/signup?next=${encodeURIComponent(`/join/${token}`)}`);
  }

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
          Accept to join the group that invited you. You keep your own calendar
          — only what people choose to share crosses over.
        </p>

        <AcceptInvite token={token} />

        <Link
          href="/calendar"
          className="mt-4 inline-flex text-[13px] font-medium text-ink-muted hover:text-ink"
        >
          Skip for now
        </Link>
      </div>
    </main>
  );
}
