"use client";

import clsx from "clsx";
import { Laptop, Loader2, Smartphone, Tablet, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";

/**
 * Which devices actually get notifications.
 *
 * A push subscription belongs to one browser on one device: turning
 * notifications on at a desk does nothing for the phone in your pocket. That
 * is easy to miss and looks exactly like a broken app — "it works on my
 * computer but not my phone" — so the list says plainly what is registered.
 */

interface Device {
  endpoint: string;
  user_agent: string | null;
  created_at: string;
}

type Kind = "phone" | "tablet" | "computer";

/** A name somebody would recognise, from the user agent the browser gave us. */
function describe(ua: string | null): { kind: Kind; name: string } {
  const s = ua ?? "";
  const browser = /\bEdg\//.test(s)
    ? "Edge"
    : /\bOPR\//.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : "browser";

  if (/iPhone/.test(s)) return { kind: "phone", name: `iPhone · ${browser}` };
  if (/iPad/.test(s)) return { kind: "tablet", name: `iPad · ${browser}` };
  if (/Android/.test(s)) {
    return /Mobile/.test(s)
      ? { kind: "phone", name: `Android phone · ${browser}` }
      : { kind: "tablet", name: `Android tablet · ${browser}` };
  }
  if (/Windows/.test(s)) return { kind: "computer", name: `Windows PC · ${browser}` };
  if (/Macintosh/.test(s)) return { kind: "computer", name: `Mac · ${browser}` };
  if (/Linux/.test(s)) return { kind: "computer", name: `Linux PC · ${browser}` };
  return { kind: "computer", name: browser };
}

const ICON = { phone: Smartphone, tablet: Tablet, computer: Laptop };

export function PushDevices({ refreshKey }: { refreshKey: number }) {
  const { supabase } = useStore();
  const [devices, setDevices] = useState<Device[] | null>(null);
  const [here, setHere] = useState<string | null>(null);

  const load = () => {
    void (async () => {
      const [{ data }, registration] = await Promise.all([
        supabase
          .from("cc_push_subscriptions")
          .select("endpoint,user_agent,created_at")
          .order("created_at", { ascending: true }),
        navigator.serviceWorker?.getRegistration(),
      ]);
      const subscription = await registration?.pushManager.getSubscription();
      setHere(subscription?.endpoint ?? null);
      setDevices((data ?? []) as Device[]);
    })().catch(() => setDevices([]));
  };

  useEffect(load, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const forget = async (endpoint: string) => {
    setDevices((current) => current?.filter((d) => d.endpoint !== endpoint) ?? null);
    await supabase.from("cc_push_subscriptions").delete().eq("endpoint", endpoint);
  };

  if (devices === null) {
    return (
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-ink-faint">
        <Loader2 size={12} className="animate-spin" /> Checking your devices…
      </p>
    );
  }

  if (!devices.length) return null;

  const hasPocket = devices.some((d) => describe(d.user_agent).kind !== "computer");

  return (
    <div className="mt-3 border-t border-line pt-3">
      <p className="text-[11px] font-semibold tracking-wider text-ink-faint uppercase">
        Getting notifications
      </p>

      <ul className="mt-1.5 space-y-1">
        {devices.map((device) => {
          const { kind, name } = describe(device.user_agent);
          const Icon = ICON[kind];
          const current = device.endpoint === here;
          return (
            <li
              key={device.endpoint}
              className="group flex items-center gap-2 rounded-lg py-1 pr-1 pl-0.5 text-[13px]"
            >
              <Icon size={15} className="shrink-0 text-ink-faint" />
              <span className={clsx("min-w-0 truncate", current ? "text-ink" : "text-ink-muted")}>
                {name}
              </span>
              {current && (
                <span className="shrink-0 rounded-full bg-brand-soft px-1.5 py-0.5 text-[10px] font-semibold text-brand">
                  this one
                </span>
              )}
              <button
                type="button"
                onClick={() => void forget(device.endpoint)}
                title="Stop notifying this device"
                className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-faint opacity-0 transition group-hover:opacity-100 hover:bg-surface-2 hover:text-ink focus-visible:opacity-100"
              >
                <X size={13} />
              </button>
            </li>
          );
        })}
      </ul>

      {!hasPocket && (
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
          No phone here yet. Notifications are granted per device, so turning
          them on at a computer does nothing for a phone — open the calendar on
          the phone itself, add it to the Home Screen, and turn them on there.
          On an iPhone the Home Screen step is required, not optional.
        </p>
      )}
    </div>
  );
}
