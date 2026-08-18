"use client";

import clsx from "clsx";
import { ExternalLink, MapPin } from "lucide-react";
import { isMappable, linkify, mapsUrl } from "@/lib/links";

/** Notes and free text, with URLs and email addresses made clickable. */
export function SmartText({ text, className }: { text: string; className?: string }) {
  return (
    <span className={className}>
      {linkify(text).map((part, i) =>
        part.kind === "text" ? (
          <span key={i}>{part.value}</span>
        ) : (
          <a
            key={i}
            href={part.href}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="font-medium text-brand underline underline-offset-2 hover:text-brand-strong"
          >
            {part.value}
          </a>
        ),
      )}
    </span>
  );
}

/**
 * A location that opens Google Maps in one click. Anything that reads as a
 * meeting link (Meet, Zoom, a URL) opens the link instead of a map.
 */
export function LocationLink({
  location,
  className,
  showIcon = true,
}: {
  location: string;
  className?: string;
  showIcon?: boolean;
}) {
  const mappable = isMappable(location);
  const firstLink = linkify(location).find((part) => part.kind === "link");
  const href = mappable ? mapsUrl(location) : firstLink?.href;

  if (!href) return <span className={className}>{location}</span>;

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title={mappable ? `Open “${location}” in Google Maps` : `Open ${location}`}
      className={clsx(
        "inline-flex items-center gap-1 text-brand underline-offset-2 hover:underline",
        className,
      )}
    >
      {showIcon &&
        (mappable ? (
          <MapPin size={12} className="shrink-0" />
        ) : (
          <ExternalLink size={12} className="shrink-0" />
        ))}
      <span className="truncate">{location}</span>
    </a>
  );
}
