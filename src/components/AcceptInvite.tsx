"use client";

import { CheckCircle2, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { acceptInvitation } from "@/lib/db";
import { createClient } from "@/lib/supabase/client";

/** Redeems the invitation token against cc_accept_invitation(). */
export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    setState("busy");
    setError(null);
    try {
      await acceptInvitation(createClient(), token);
      setState("done");
      setTimeout(() => {
        router.push("/calendar");
        router.refresh();
      }, 900);
    } catch (e) {
      setError(e instanceof Error ? e.message : "This invitation is no longer valid.");
      setState("idle");
    }
  };

  if (state === "done") {
    return (
      <p className="mt-6 flex items-center justify-center gap-2 text-[14px] font-medium text-[#3f9142]">
        <CheckCircle2 size={16} /> You are in — opening your calendar…
      </p>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={accept}
        disabled={state === "busy"}
        className="inline-flex h-11 w-full items-center justify-center rounded-xl bg-brand px-6 text-[15px] font-semibold text-white transition hover:bg-brand-strong disabled:opacity-60"
      >
        {state === "busy" ? "Joining…" : "Accept the invitation"}
      </button>
      {error && (
        <p className="mt-3 flex items-start justify-center gap-1.5 text-[12px] text-[#d1443c]">
          <TriangleAlert size={13} className="mt-px shrink-0" />
          {error}
        </p>
      )}
    </div>
  );
}
