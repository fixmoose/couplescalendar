"use client";

import clsx from "clsx";
import { Download, FileText, ImageIcon, Paperclip, X } from "lucide-react";
import { useEffect, useState } from "react";
import { attachmentUrl, formatBytes, isImage, isPdf } from "@/lib/files";
import type { Attachment } from "@/lib/types";

/** Resolves the stored bytes to a URL for preview and download. */
function useAttachmentUrl(attachment: Attachment) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let revoked: string | null = null;
    let alive = true;
    attachmentUrl(attachment).then((next) => {
      if (!alive) {
        if (next) URL.revokeObjectURL(next);
        return;
      }
      revoked = next;
      setUrl(next);
    });
    return () => {
      alive = false;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [attachment]);

  return url;
}

function Thumb({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);

  if (isImage(attachment.type) && url) {
    return (
      // Blob URLs cannot go through next/image, and these are user files.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        className="h-9 w-9 shrink-0 rounded-md border border-line object-cover"
      />
    );
  }
  return (
    <span
      className={clsx(
        "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-line",
        isPdf(attachment.type) ? "bg-[#d1443c]/10 text-[#d1443c]" : "bg-surface-2 text-ink-muted",
      )}
    >
      {isImage(attachment.type) ? <ImageIcon size={16} /> : <FileText size={16} />}
    </span>
  );
}

export function AttachmentRow({
  attachment,
  onRemove,
}: {
  attachment: Attachment;
  onRemove?: () => void;
}) {
  const url = useAttachmentUrl(attachment);

  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-line bg-surface px-2 py-1.5">
      <Thumb attachment={attachment} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-ink">
          {attachment.name}
        </span>
        <span className="block text-[11px] text-ink-faint">
          {formatBytes(attachment.size)}
          {isPdf(attachment.type) ? " · PDF" : ""}
        </span>
      </span>
      {url && (
        <a
          href={url}
          download={attachment.name}
          target="_blank"
          rel="noreferrer"
          title="Open or download"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink"
        >
          <Download size={14} />
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-[#d1443c]"
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function AttachmentList({
  attachments,
  onRemove,
}: {
  attachments: Attachment[];
  onRemove?: (id: string) => void;
}) {
  if (attachments.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {attachments.map((attachment) => (
        <AttachmentRow
          key={attachment.id}
          attachment={attachment}
          onRemove={onRemove ? () => onRemove(attachment.id) : undefined}
        />
      ))}
    </div>
  );
}

/** The little paperclip + count shown on an event in the grid. */
export function AttachmentBadge({
  count,
  className,
}: {
  count: number;
  className?: string;
}) {
  if (count === 0) return null;
  return (
    <span
      className={clsx("flex shrink-0 items-center gap-0.5 text-[10px] font-semibold", className)}
      title={`${count} file${count === 1 ? "" : "s"}`}
    >
      <Paperclip size={10} />
      {count > 1 && count}
    </span>
  );
}
