"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { publicUrl } from "@/lib/site";

/**
 * Scan-to-install. Drawn in the browser rather than fetched from an image
 * service, so nothing about this calendar leaves the page to make it.
 */
export function InstallQr() {
  const [src, setSrc] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const url = `${publicUrl()}/calendar`;

  useEffect(() => {
    void QRCode.toDataURL(url, {
      width: 320,
      margin: 1,
      color: { dark: "#1a1a1e", light: "#ffffff" },
      errorCorrectionLevel: "M",
    }).then(setSrc);
  }, [url]);

  return (
    <div className="flex items-center gap-4">
      <span className="flex h-[132px] w-[132px] shrink-0 items-center justify-center rounded-xl border border-line bg-white p-2">
        {src ? (
          // A data URL drawn locally; next/image would only get in the way.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={`QR code for ${url}`} className="h-full w-full" />
        ) : (
          <Loader2 size={18} className="animate-spin text-ink-faint" />
        )}
      </span>

      <div className="min-w-0">
        <p className="text-[13px] leading-relaxed font-medium text-ink">
          Point your phone camera at this
        </p>
        <p className="mt-1 text-[12px] leading-relaxed text-ink-muted">
          It opens the calendar on your phone. Sign in there once, then add it
          to your Home Screen.
        </p>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard?.writeText(url);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          }}
          className="mt-2 flex items-center gap-1.5 text-[12px] font-medium text-brand hover:underline"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Link copied" : "Copy the link instead"}
        </button>
      </div>
    </div>
  );
}
