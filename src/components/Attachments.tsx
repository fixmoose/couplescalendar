"use client";

import clsx from "clsx";
import {
  Download,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FileType,
  ImageIcon,
  Loader2,
  Paperclip,
  Presentation,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { attachmentUrl } from "@/lib/db";
import { formatBytes, isImage, isPdf, isText } from "@/lib/files";
import { useStore } from "@/lib/store";
import type { Attachment } from "@/lib/types";
import { HoverCard } from "./HoverCard";

/**
 * Signed URL for a private file. Anyone who can see the event in full can
 * read its files — that is the storage policy, so the download simply works
 * for the people you shared with and nobody else.
 */
function useAttachmentUrl(attachment: Attachment, enabled = true) {
  const { supabase } = useStore();
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void attachmentUrl(supabase, attachment).then((next) => {
      if (alive) setUrl(next);
    });
    return () => {
      alive = false;
    };
  }, [attachment, enabled, supabase]);

  return url;
}

/** Icon for a MIME type — rendered directly so no component is built in render. */
function FileIcon({ type, size }: { type: string; size: number }) {
  if (isImage(type)) return <ImageIcon size={size} />;
  if (isPdf(type)) return <FileType size={size} />;
  if (type.includes("spreadsheet") || type.includes("excel") || type.includes("csv")) {
    return <FileSpreadsheet size={size} />;
  }
  if (type.includes("presentation") || type.includes("powerpoint")) {
    return <Presentation size={size} />;
  }
  return <FileText size={size} />;
}

function Thumb({ attachment, size = 36 }: { attachment: Attachment; size?: number }) {
  const url = useAttachmentUrl(attachment, isImage(attachment.type));

  if (isImage(attachment.type) && url) {
    return (
      // A signed blob from Storage — next/image cannot optimise these.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt=""
        style={{ width: size, height: size }}
        className="shrink-0 rounded-md border border-line object-cover"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size }}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-md border border-line",
        isPdf(attachment.type)
          ? "bg-[#d1443c]/10 text-[#d1443c]"
          : "bg-surface-2 text-ink-muted",
      )}
    >
      <FileIcon type={attachment.type} size={size * 0.45} />
    </span>
  );
}

/**
 * The preview panel. Images render inline, PDFs get the browser's own viewer,
 * text files show their first lines, and everything else falls back to type,
 * size and an open link — so the card is useful whatever was dropped.
 */
export function AttachmentPreview({ attachment }: { attachment: Attachment }) {
  const url = useAttachmentUrl(attachment);
  const [text, setText] = useState<string | null>(null);
  const previewable = isImage(attachment.type) || isPdf(attachment.type);

  useEffect(() => {
    if (!url || !isText(attachment.type)) return;
    let alive = true;
    void fetch(url)
      .then((r) => r.text())
      .then((body) => alive && setText(body.slice(0, 800)));
    return () => {
      alive = false;
    };
  }, [url, attachment.type]);

  return (
    <div>
      <div className="flex h-[190px] items-center justify-center border-b border-line bg-surface-2">
        {!url && <Loader2 size={18} className="animate-spin text-ink-faint" />}

        {url && isImage(attachment.type) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={attachment.name} className="max-h-full max-w-full object-contain" />
        )}

        {url && isPdf(attachment.type) && (
          <iframe
            src={`${url}#toolbar=0&navpanes=0&view=FitH`}
            title={attachment.name}
            className="h-full w-full"
          />
        )}

        {url && isText(attachment.type) && (
          <pre className="h-full w-full overflow-hidden p-3 text-[10px] leading-relaxed whitespace-pre-wrap text-ink-muted">
            {text ?? "…"}
          </pre>
        )}

        {url && !previewable && !isText(attachment.type) && (
          <div className="flex flex-col items-center gap-2 text-ink-faint">
            <Thumb attachment={attachment} size={44} />
            <span className="text-[11px]">No preview for this file type</span>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[12px] font-medium text-ink">
            {attachment.name}
          </span>
          <span className="block text-[11px] text-ink-faint">
            {formatBytes(attachment.size)}
          </span>
        </span>
        {url && (
          <>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              title="Open in a new tab"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink"
            >
              <ExternalLink size={14} />
            </a>
            <a
              href={url}
              download={attachment.name}
              title="Download"
              className="flex h-7 w-7 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink"
            >
              <Download size={14} />
            </a>
          </>
        )}
      </div>
    </div>
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
      <HoverCard panel={<AttachmentPreview attachment={attachment} />} width={320}>
        <Thumb attachment={attachment} />
      </HoverCard>

      <HoverCard
        panel={<AttachmentPreview attachment={attachment} />}
        width={320}
        className="min-w-0 flex-1"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-ink">
            {attachment.name}
          </span>
          <span className="block text-[11px] text-ink-faint">
            {formatBytes(attachment.size)}
            {isPdf(attachment.type) ? " · PDF" : ""}
          </span>
        </span>
      </HoverCard>

      {url && (
        <a
          href={url}
          download={attachment.name}
          target="_blank"
          rel="noreferrer"
          title="Download"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-ink"
        >
          <Download size={14} />
        </a>
      )}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          title="Remove"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-ink-faint transition hover:bg-surface-2 hover:text-[#d1443c]"
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

/** Paperclip on an event; hovering it previews the file without opening anything. */
export function AttachmentBadge({
  count,
  attachments,
  className,
}: {
  count: number;
  attachments?: Attachment[];
  className?: string;
}) {
  if (count === 0) return null;

  const badge = (
    <span
      className={clsx("flex shrink-0 items-center gap-0.5 text-[10px] font-semibold", className)}
    >
      <Paperclip size={10} />
      {count > 1 && count}
    </span>
  );

  if (!attachments?.length) return badge;

  return (
    <HoverCard
      width={320}
      panel={
        attachments.length === 1 ? (
          <AttachmentPreview attachment={attachments[0]} />
        ) : (
          <div className="max-h-[320px] space-y-1.5 overflow-auto p-2">
            {attachments.map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </div>
        )
      }
    >
      {badge}
    </HoverCard>
  );
}
