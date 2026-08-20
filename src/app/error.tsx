"use client";

import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

/**
 * Anything that throws while rendering lands here instead of showing a blank
 * page. It also reports itself, so a crash on somebody else's screen can be
 * read from the deployment log rather than described over the phone.
 */
export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        operation: "render-crash",
        code: error.digest ?? "client",
        message: error.message,
        detail: error.stack?.split("\n").slice(0, 6).join(" | "),
        hasSession: null,
      }),
    }).catch(() => {});
  }, [error]);

  return (
    <main className="flex min-h-full items-center justify-center bg-bg px-4 py-16">
      <div className="w-full max-w-md rounded-2xl border border-line bg-surface p-7 text-center shadow-[var(--shadow-md)]">
        <TriangleAlert size={28} className="mx-auto text-[#d1443c]" />
        <h1 className="mt-4 text-[19px] font-bold tracking-tight text-ink">
          Something went wrong
        </h1>
        <p className="mt-2 text-[14px] leading-relaxed text-ink-muted">
          The calendar hit an error and stopped. Nothing you saved is lost.
        </p>

        <pre className="mt-4 max-h-[140px] overflow-auto rounded-lg bg-surface-2 p-3 text-left text-[11px] leading-relaxed break-words whitespace-pre-wrap text-ink-muted">
          {error.message}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>

        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-5 text-sm font-medium text-white transition hover:bg-brand-strong"
          >
            <RefreshCw size={15} /> Try again
          </button>
          <button
            type="button"
            onClick={() => {
              void navigator.clipboard?.writeText(
                `${error.message}\n${error.digest ?? ""}\n${error.stack ?? ""}`,
              );
            }}
            className="inline-flex h-10 items-center rounded-lg border border-line px-4 text-sm text-ink-muted transition hover:bg-surface-2 hover:text-ink"
          >
            Copy details
          </button>
        </div>
      </div>
    </main>
  );
}
