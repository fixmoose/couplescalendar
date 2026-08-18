"use client";

/**
 * Where to go after signing in.
 *
 * Kept in sessionStorage rather than in the OAuth redirect URL: Supabase
 * checks the redirect against an allow-list, and a pattern without a wildcard
 * fails to match a URL carrying a query string — which silently sends people
 * to the project's Site URL instead. Nothing app-specific belongs in that URL.
 */

const KEY = "cc.next";

export function rememberNext(path: string) {
  try {
    if (path && path.startsWith("/") && path !== "/calendar") {
      window.sessionStorage.setItem(KEY, path);
    } else {
      window.sessionStorage.removeItem(KEY);
    }
  } catch {
    /* private mode — we just fall back to /calendar */
  }
}

export function takeNext(): string | null {
  try {
    const value = window.sessionStorage.getItem(KEY);
    window.sessionStorage.removeItem(KEY);
    return value && value.startsWith("/") ? value : null;
  } catch {
    return null;
  }
}
