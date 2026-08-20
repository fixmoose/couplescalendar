"use client";

import { CheckCircle2, Share, Smartphone } from "lucide-react";
import { useState } from "react";
import { InstallQr } from "./InstallQr";
import { detectPlatform, isStandalone } from "./NotificationHelp";

/**
 * Getting the calendar onto a phone. There is no app to download: the site
 * installs itself, which is also what lets iOS deliver notifications at all.
 */
export function InstallHint() {
  const [{ platform, installed }] = useState(() =>
    typeof window === "undefined"
      ? { platform: "other", installed: false }
      : { platform: detectPlatform(), installed: isStandalone() },
  );

  if (installed) {
    return (
      <p className="flex items-center gap-1.5 text-[13px] text-[#3f9142]">
        <CheckCircle2 size={14} /> Installed on this device.
      </p>
    );
  }

  const steps =
    platform === "ios"
      ? [
          "Open calendar.docmaker.studio in Safari",
          "Tap the Share button",
          "Choose “Add to Home Screen”",
          "Open it from the new icon — notifications only work from there",
        ]
      : platform === "android"
        ? [
            "Open calendar.docmaker.studio in Chrome",
            "Open the browser menu (⋮)",
            "Choose “Install app” or “Add to Home screen”",
          ]
        : [
            "Open calendar.docmaker.studio on your phone",
            "iPhone: Share → Add to Home Screen",
            "Android: browser menu → Install app",
          ];

  return (
    <div>
      <InstallQr />

      <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-ink-muted">
        <Smartphone size={14} className="mt-px shrink-0 text-brand" />
        There is no app to download — the calendar installs itself from the
        browser and then behaves like one, icon and all.
      </p>
      <ol className="mt-2 space-y-1">
        {steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
            <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[10px] font-semibold text-ink-faint">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
      {platform === "ios" && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-2 text-[12px] leading-relaxed text-brand">
          <Share size={13} className="mt-px shrink-0" />
          On iPhone this step is not optional: Safari only sends notifications to
          a calendar that lives on the Home Screen.
        </p>
      )}
    </div>
  );
}
