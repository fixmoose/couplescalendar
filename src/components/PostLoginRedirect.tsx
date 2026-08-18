"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { takeNext } from "@/lib/next-url";

/**
 * Sends people on to wherever they were headed before signing in — an invite
 * link, usually. Runs once, on the calendar, after the session exists.
 */
export function PostLoginRedirect() {
  const router = useRouter();

  useEffect(() => {
    const next = takeNext();
    if (next) router.replace(next);
  }, [router]);

  return null;
}
