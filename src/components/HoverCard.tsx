"use client";

import clsx from "clsx";
import {
  useCallback,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

/**
 * A hover panel that survives the trip from the trigger to the panel itself,
 * so the content inside stays clickable (download links, "open" buttons).
 *
 * Rendered fixed and flipped into view rather than clipped by the calendar's
 * scroll containers.
 */
export function HoverCard({
  children,
  panel,
  delay = 220,
  className,
  width = 300,
}: {
  children: ReactNode;
  panel: ReactNode;
  delay?: number;
  className?: string;
  width?: number;
}) {
  const trigger = useRef<HTMLSpanElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<number | null>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const show = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(true), delay);
  }, [delay]);

  const hide = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setOpen(false), 120);
  }, []);

  useLayoutEffect(() => {
    if (!open || !trigger.current) return;
    const rect = trigger.current.getBoundingClientRect();
    const height = card.current?.offsetHeight ?? 200;
    const above = rect.top > height + 16 && rect.bottom > window.innerHeight - height;
    setPos({
      x: Math.min(Math.max(8, rect.left), window.innerWidth - width - 8),
      y: above ? rect.top - height - 8 : Math.min(rect.bottom + 8, window.innerHeight - height - 8),
    });
  }, [open, width]);

  return (
    <>
      <span
        ref={trigger}
        onMouseEnter={show}
        onMouseLeave={hide}
        onFocus={show}
        onBlur={hide}
        className={clsx("inline-flex", className)}
      >
        {children}
      </span>
      {open && (
        <div
          ref={card}
          onMouseEnter={show}
          onMouseLeave={hide}
          style={{ left: pos.x, top: pos.y, width }}
          className="cc-pop fixed z-[60] overflow-hidden rounded-xl border border-line bg-surface shadow-[var(--shadow-lg)]"
        >
          {panel}
        </div>
      )}
    </>
  );
}
