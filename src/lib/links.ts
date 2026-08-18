/**
 * Turning text people typed into things they can click: a location becomes a
 * map, a URL becomes a link, an email becomes a mailto.
 */

const URL_PATTERN = /\b((?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?])/gi;
const EMAIL_PATTERN = /\b([\w.+-]+@[\w-]+\.[\w.-]+)\b/gi;

/** Meeting links belong in a browser, not on a map. */
const VIRTUAL = /^(https?:\/\/|www\.)|^(meet|zoom|teams|skype|phone|call|online|tbd)$/i;

export function isMappable(location: string) {
  const value = location.trim();
  return value.length > 2 && !VIRTUAL.test(value);
}

/** Google Maps search — works with an address, a place name or coordinates. */
export function mapsUrl(location: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.trim())}`;
}

export function externalUrl(value: string) {
  return value.startsWith("http") ? value : `https://${value}`;
}

export type TextPart =
  | { kind: "text"; value: string }
  | { kind: "link"; value: string; href: string };

/** Splits text into plain runs and clickable links, in order. */
export function linkify(text: string): TextPart[] {
  const parts: TextPart[] = [];
  let index = 0;

  const matches = [
    ...text.matchAll(URL_PATTERN),
    ...text.matchAll(EMAIL_PATTERN),
  ].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));

  for (const match of matches) {
    const start = match.index ?? 0;
    if (start < index) continue; // overlapping match, already covered
    if (start > index) parts.push({ kind: "text", value: text.slice(index, start) });
    const value = match[0];
    parts.push({
      kind: "link",
      value,
      href: value.includes("@") && !value.startsWith("http")
        ? `mailto:${value}`
        : externalUrl(value),
    });
    index = start + value.length;
  }

  if (index < text.length) parts.push({ kind: "text", value: text.slice(index) });
  return parts;
}
