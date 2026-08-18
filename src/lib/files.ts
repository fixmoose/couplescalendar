"use client";

import type { Attachment } from "./types";

/**
 * File storage for phase 1.
 *
 * Bytes go to IndexedDB (localStorage would blow its quota on the first PDF);
 * only the metadata in `Attachment` is kept in the store. Phase 2 replaces the
 * two functions below with Supabase Storage uploads into the `cc_attachments`
 * bucket — everything else, including the drop handling, stays as it is.
 */

const DB_NAME = "cc.files";
const STORE = "blobs";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const request = fn(db.transaction(STORE, mode).objectStore(STORE));
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  }).finally(() => db.close());
}

export const putBlob = (key: string, blob: Blob) =>
  tx("readwrite", (store) => store.put(blob, key));

export const getBlob = (key: string) =>
  tx<Blob | undefined>("readonly", (store) => store.get(key));

export const deleteBlob = (key: string) =>
  tx("readwrite", (store) => store.delete(key));

/** 25 MB — the same ceiling we will put on the storage bucket. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export class FileTooLargeError extends Error {
  constructor(public fileName: string) {
    super(`${fileName} is larger than ${formatBytes(MAX_FILE_BYTES)}`);
  }
}

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

export function isImage(type: string) {
  return type.startsWith("image/");
}

export function isPdf(type: string) {
  return type === "application/pdf";
}

/** Stores the bytes and returns the metadata the event will carry. */
export async function storeFile(file: File, uploadedBy: string): Promise<Attachment> {
  if (file.size > MAX_FILE_BYTES) throw new FileTooLargeError(file.name);
  const id = `f_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
  await putBlob(id, file);
  return {
    id,
    name: file.name,
    size: file.size,
    type: file.type || "application/octet-stream",
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };
}

export async function storeFiles(files: File[], uploadedBy: string) {
  const stored: Attachment[] = [];
  const failed: string[] = [];
  for (const file of files) {
    try {
      stored.push(await storeFile(file, uploadedBy));
    } catch {
      failed.push(file.name);
    }
  }
  return { stored, failed };
}

/** Object URL for previewing or downloading; revoke when you are done. */
export async function attachmentUrl(attachment: Attachment) {
  const blob = await getBlob(attachment.id);
  return blob ? URL.createObjectURL(blob) : null;
}

/** Pulls real files out of a drag event, ignoring text/link drags. */
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
