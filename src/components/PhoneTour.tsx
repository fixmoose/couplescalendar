"use client";

import clsx from "clsx";
import { ArrowRight, Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "./ui";

/**
 * The first-run walkthrough, on phones only.
 *
 * A phone hides most of the calendar behind buttons — the sidebar is a drawer,
 * creating is a round +, notifications live under an avatar — and none of that
 * announces itself the way a desktop toolbar does. So the first time somebody
 * opens the calendar on a phone, the screen dims, one control at a time is lit
 * up, and an arrow points at it with a sentence about what it does.
 *
 * It runs once. Settings can run it again.
 */

export const TOUR_SEEN_KEY = "cc.phone-tour.v1";

interface Step {
  /** The data-tour attribute of the control to light up. */
  target: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    target: "menu",
    title: "Your calendars live here",
    body: "Tap the three lines for your calendars, the people who share with you, and your groups. It slides over, and slides away again.",
  },
  {
    target: "views",
    title: "Four ways to look",
    body: "Day is one day as a list — the clearest on a phone. 3 days shows a grid you can read. Month shows a dot per event. Agenda is everything coming up, in order.",
  },
  {
    target: "today",
    title: "Move about",
    body: "The arrows go back and forward — a day at a time in Day, three at a time in 3 days, a month in Month. Today always brings you home.",
  },
  {
    target: "create",
    title: "Add something",
    body: "This is how you make an event. It starts on the day you are looking at, and you set the time, the place, who sees it and when to be reminded.",
  },
  {
    target: "bell",
    title: "What has happened",
    body: "Shares, reminders and pinned notes collect here, each in its own colour. They wait until you answer them, so nothing slips past while your phone is in a pocket.",
  },
  {
    target: "account",
    title: "Settings, and notifications",
    body: "Your account, the clock format, light or dark, and recently deleted. Turn notifications on here too — each phone and computer asks separately.",
  },
];

interface Spot {
  top: number;
  left: number;
  width: number;
  height: number;
}

export function PhoneTour({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [spot, setSpot] = useState<Spot | null>(null);

  const step = STEPS[index];

  // Where is the control this step is about? Re-measured on every step and
  // whenever the phone is turned, since none of these positions are fixed.
  useEffect(() => {
    const measure = () => {
      const el = document.querySelector(`[data-tour="${STEPS[index].target}"]`);
      if (!el) return setSpot(null);
      const r = el.getBoundingClientRect();
      setSpot({ top: r.top, left: r.left, width: r.width, height: r.height });
    };
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("orientationchange", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("orientationchange", measure);
    };
  }, [index]);

  const last = index === STEPS.length - 1;
  const pad = 6;

  // The card goes under the highlight, or above it when the control is low
  // down — a tooltip covering the thing it describes is no use.
  const below = !spot || spot.top < window.innerHeight / 2;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-label="How this works">
      {/*
       * One element does the dimming: a small transparent box over the
       * control, with an enormous shadow filling the rest of the screen.
       */}
      <div
        className="pointer-events-none absolute rounded-xl ring-2 ring-white/80 transition-all duration-300"
        style={{
          top: spot ? spot.top - pad : -9999,
          left: spot ? spot.left - pad : -9999,
          width: spot ? spot.width + pad * 2 : 0,
          height: spot ? spot.height + pad * 2 : 0,
          boxShadow: "0 0 0 9999px rgba(10, 10, 14, 0.72)",
        }}
      />

      {/* Taps anywhere else move on, rather than doing nothing. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        onClick={() => (last ? onDone() : setIndex(index + 1))}
        className="absolute inset-0 z-0 h-full w-full cursor-default"
      />

      {spot && (
        <ArrowRight
          size={26}
          strokeWidth={2.5}
          className={clsx(
            "pointer-events-none absolute z-10 text-white drop-shadow",
            below ? "-rotate-90" : "rotate-90",
          )}
          style={{
            left: Math.min(
              Math.max(spot.left + spot.width / 2 - 13, 12),
              window.innerWidth - 38,
            ),
            top: below ? spot.top + spot.height + 12 : spot.top - 40,
          }}
        />
      )}

      <div
        className="cc-pop absolute right-3 left-3 z-10 rounded-2xl bg-surface p-4 shadow-[var(--shadow-lg)]"
        style={
          below
            ? { top: (spot?.top ?? 0) + (spot?.height ?? 0) + 48 }
            : { bottom: window.innerHeight - (spot?.top ?? 0) + 48 }
        }
      >
        <div className="flex items-start gap-2">
          <h2 className="min-w-0 flex-1 text-[17px] leading-tight font-semibold text-ink">
            {step.title}
          </h2>
          <button
            type="button"
            onClick={onDone}
            aria-label="Skip"
            className="-mt-1 -mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-ink-faint hover:bg-surface-2 hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>

        <p className="mt-1.5 text-[14px] leading-relaxed text-ink-muted">{step.body}</p>

        <div className="mt-4 flex items-center gap-2">
          <span className="flex gap-1.5">
            {STEPS.map((s, i) => (
              <span
                key={s.target}
                className={clsx(
                  "h-1.5 rounded-full transition-all",
                  i === index ? "w-4 bg-brand" : "w-1.5 bg-line-strong",
                )}
              />
            ))}
          </span>

          {index > 0 && (
            <Button onClick={() => setIndex(index - 1)} className="ml-auto h-9 px-3">
              Back
            </Button>
          )}

          <Button
            variant="primary"
            onClick={() => (last ? onDone() : setIndex(index + 1))}
            className={clsx("h-9 px-4", index === 0 && "ml-auto")}
          >
            {last ? (
              <>
                <Check size={15} /> Got it
              </>
            ) : (
              "Next"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
