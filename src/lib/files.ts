"use client";

/**
 * File helpers. Uploads themselves live in src/lib/db.ts (Supabase Storage);
 * this module holds the pure bits the UI needs to describe a file.
 */

/** 25 MB — matches the ceiling on the cc_attachments bucket. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Strips the extension — used as the suggested event title. */
export function titleFromFileName(name: string) {
  const base = name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  return base ? base.charAt(0).toUpperCase() + base.slice(1) : name;
}

export const isImage = (type: string) => type.startsWith("image/");
export const isPdf = (type: string) => type === "application/pdf";
export const isText = (type: string) =>
  type.startsWith("text/") || type === "application/json";

/** Pulls real files out of a drag event, ignoring text and link drags. */
export function filesFromDrag(e: React.DragEvent): File[] {
  const items = e.dataTransfer?.items;
  if (items?.length) {
    return [...items]
      .filter((i) => i.kind === "file")
      .map((i) => i.getAsFile())
      .filter((f): f is File => f !== null);
  }
  return [...(e.dataTransfer?.files ?? [])];
}

export function dragHasFiles(e: React.DragEvent) {
  return [...(e.dataTransfer?.types ?? [])].includes("Files");
}
