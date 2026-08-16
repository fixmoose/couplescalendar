import type { CSSProperties } from "react";
import type { ColorKey } from "./types";

/**
 * Base hues. Everything the UI paints (dot, chip fill, chip text, border) is
 * mixed from these in CSS — see the `.cc-*` helpers in globals.css — so the
 * same key stays legible in light and dark mode.
 */
export const COLORS: Record<ColorKey, { hex: string; label: string }> = {
  orange: { hex: "#dc6b15", label: "Orange" },
  teal: { hex: "#0d9488", label: "Teal" },
  violet: { hex: "#7c5cf0", label: "Violet" },
  rose: { hex: "#e0447a", label: "Rose" },
  blue: { hex: "#2f7ce0", label: "Blue" },
  green: { hex: "#3f9142", label: "Green" },
  amber: { hex: "#c8930b", label: "Amber" },
  slate: { hex: "#5b6472", label: "Slate" },
};

export const COLOR_KEYS = Object.keys(COLORS) as ColorKey[];

/** Inline style that arms the `.cc-dot` / `.cc-tint` / `.cc-solid` helpers. */
export function colorVar(key: ColorKey): CSSProperties {
  return { ["--c" as string]: COLORS[key].hex } as CSSProperties;
}
