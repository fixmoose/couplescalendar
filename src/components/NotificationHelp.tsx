"use client";

import clsx from "clsx";
import { Globe, Laptop, Monitor, Share, Smartphone } from "lucide-react";
import { useState } from "react";

/**
 * What to actually click, per browser, when notifications will not turn on.
 *
 * Browsers increasingly refuse the permission prompt without showing it, so
 * "click allow" is not advice — the path through settings is.
 */

type Platform = "ios" | "android" | "edge" | "chrome" | "safari" | "firefox" | "other";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/\bEdg\//.test(ua)) return "edge";
  if (/Firefox\//.test(ua)) return "firefox";
  if (/Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}

export const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as { standalone?: boolean }).standalone === true);

const STEPS: Record<Platform, { title: string; steps: string[]; icon: typeof Globe }> = {
  ios: {
    title: "iPhone or iPad",
    icon: Smartphone,
    steps: [
      "Notifications only work once the calendar is on your Home Screen — Apple requires it.",
      "In Safari, tap the Share button, then “Add to Home Screen”.",
      "Open the calendar from the new icon, not from Safari.",
      "Go to Settings → Turn on notifications, and tap Allow.",
      "If nothing appears: iPhone Settings → Notifications → Calendar → Allow Notifications.",
    ],
  },
  android: {
    title: "Android",
    icon: Smartphone,
    steps: [
      "Open the browser menu and choose “Install app” or “Add to Home screen” — optional, but it behaves like an app afterwards.",
      "Go to Settings → Turn on notifications, and tap Allow.",
      "If nothing appears: browser menu → Settings → Site settings → Notifications, and allow this site.",
      "Also check Android Settings → Apps → your browser → Notifications is on.",
    ],
  },
  edge: {
    title: "Microsoft Edge",
    icon: Monitor,
    steps: [
      "Edge often blocks the request before it appears.",
      "Open edge://settings/content/notifications and make sure “Ask before sending” is on and this site is not blocked.",
      "Or click the lock icon in the address bar → Permissions for this site → Notifications → Allow.",
      "Windows Settings → System → Notifications: Microsoft Edge must be allowed, and Focus assist off.",
      "Then come back and press Turn on notifications again.",
    ],
  },
  chrome: {
    title: "Chrome",
    icon: Globe,
    steps: [
      "Click the lock icon in the address bar → Site settings → Notifications → Allow.",
      "Or open chrome://settings/content/notifications and remove this site from the blocked list.",
      "On Windows, also check Settings → System → Notifications that Chrome is allowed.",
    ],
  },
  safari: {
    title: "Safari on a Mac",
    icon: Laptop,
    steps: [
      "Safari → Settings → Websites → Notifications, and allow calendar.docmaker.studio.",
      "System Settings → Notifications → Safari must be on.",
    ],
  },
  firefox: {
    title: "Firefox",
    icon: Monitor,
    steps: [
      "Click the lock icon in the address bar → Connection settings → clear the notification block.",
      "Or Settings → Privacy & Security → Permissions → Notifications → Settings, and allow this site.",
    ],
  },
  other: {
    title: "Your browser",
    icon: Monitor,
    steps: [
      "Look for a lock or bell icon in the address bar and allow notifications for this site.",
      "Check your operating system allows the browser to show notifications at all.",
    ],
  },
};

export function NotificationHelp({ className }: { className?: string }) {
  // Read on the first client render: neither value changes while open, and an
  // effect would mean rendering the wrong advice first.
  const [{ platform, installed }] = useState(() =>
    typeof window === "undefined"
      ? { platform: "other" as Platform, installed: true }
      : { platform: detectPlatform(), installed: isStandalone() },
  );

  const help = STEPS[platform];
  const Icon = help.icon;
  const needsInstall = platform === "ios" && !installed;

  return (
    <div className={clsx("rounded-xl border border-line bg-surface-2 p-3", className)}>
      <div className="flex items-center gap-2 text-[13px] font-semibold text-ink">
        <Icon size={15} className="text-brand" />
        {help.title}
      </div>

      {needsInstall && (
        <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-brand/30 bg-brand-soft px-2.5 py-2 text-[12px] leading-relaxed text-brand">
          <Share size={13} className="mt-px shrink-0" />
          On iPhone, add the calendar to your Home Screen first — Safari will not
          send notifications otherwise.
        </p>
      )}

      <ol className="mt-2 space-y-1.5">
        {help.steps.map((step, i) => (
          <li key={i} className="flex gap-2 text-[12px] leading-relaxed text-ink-muted">
            <span className="mt-[3px] flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-surface text-[10px] font-semibold text-ink-faint">
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
