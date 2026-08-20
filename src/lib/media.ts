"use client";

import { useSyncExternalStore } from "react";

/**
 * Matches a media query as external state, so layout follows the viewport
 * without an effect writing state on every render.
 */
export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(query);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Phones and small tablets held upright. */
export const useIsMobile = () => useMediaQuery("(max-width: 820px)");
