"use client";

import clsx from "clsx";
import { Check, ChevronRight } from "lucide-react";
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type MenuItem =
  | {
      kind?: "item";
      label: string;
      icon?: ReactNode;
      hint?: string;
      checked?: boolean;
      danger?: boolean;
      disabled?: boolean;
      onSelect: () => void;
    }
  | { kind: "separator" }
  | { kind: "heading"; label: string }
  | { kind: "submenu"; label: string; icon?: ReactNode; items: MenuItem[] };

export interface MenuState {
  x: number;
  y: number;
  items: MenuItem[];
}

const PANEL =
  "min-w-[212px] rounded-xl border border-line bg-surface p-1 shadow-[var(--shadow-md)]";

function Row({ item, onClose }: { item: MenuItem; onClose: () => void }) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<number | null>(null);

  if (item.kind === "separator") {
    return <div className="my-1 h-px bg-line" />;
  }
  if (item.kind === "heading") {
    return (
      <div className="px-2.5 pt-2 pb-1 text-[10px] font-semibold tracking-wider text-ink-faint uppercase">
        {item.label}
      </div>
    );
  }
  if (item.kind === "submenu") {
    return (
      <div
        className="relative"
        onMouseEnter={() => {
          if (closeTimer.current) window.clearTimeout(closeTimer.current);
          setOpen(true);
        }}
        onMouseLeave={() => {
          closeTimer.current = window.setTimeout(() => setOpen(false), 120);
        }}
      >
        <button
          type="button"
          className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] text-ink hover:bg-surface-2"
        >
          <span className="flex h-4 w-4 items-center justify-center text-ink-faint">
            {item.icon}
          </span>
          <span className="flex-1 truncate">{item.label}</span>
          <ChevronRight size={13} className="text-ink-faint" />
        </button>
        {open && (
          <div
            className={clsx(
              PANEL,
              "cc-pop absolute top-[-5px] left-full z-10 ml-0.5 max-h-[320px] overflow-auto",
            )}
          >
            {item.items.map((sub, i) => (
              <Row key={i} item={sub} onClose={onClose} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={item.disabled}
      onClick={() => {
        item.onSelect();
        onClose();
      }}
      className={clsx(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left text-[13px] transition disabled:opacity-40",
        item.danger ? "text-[#d1443c] hover:bg-[#d1443c]/10" : "text-ink hover:bg-surface-2",
      )}
    >
      <span className="flex h-4 w-4 items-center justify-center text-ink-faint">
        {item.icon}
      </span>
      <span className="flex-1 truncate">{item.label}</span>
      {item.checked && <Check size={13} className="text-brand" />}
      {item.hint && <span className="text-[11px] text-ink-faint">{item.hint}</span>}
    </button>
  );
}

export function ContextMenu({
  state,
  onClose,
}: {
  state: MenuState;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: state.x, y: state.y });

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    setPos({
      x: Math.min(state.x, window.innerWidth - width - 8),
      y: Math.min(state.y, window.innerHeight - height - 8),
    });
  }, [state.x, state.y]);

  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", close);
    window.addEventListener("resize", close);
    window.addEventListener("blur", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", close);
      window.removeEventListener("resize", close);
      window.removeEventListener("blur", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{ left: pos.x, top: pos.y }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      className={clsx(PANEL, "cc-pop fixed z-50")}
    >
      {state.items.map((item, i) => (
        <Row key={i} item={item} onClose={onClose} />
      ))}
    </div>
  );
}
