"use client";

import { useCallback, useRef, useState } from "react";
import { dragHasFiles, filesFromDrag } from "@/lib/files";

/**
 * Drag-and-drop plumbing for a drop target.
 *
 * dragenter/dragleave fire for every child element, so the counter below is
 * what keeps the highlight from flickering as the pointer crosses an event
 * block inside the target.
 */
export function useFileDrop(onFiles: (files: File[], e: React.DragEvent) => void) {
  const depth = useRef(0);
  const [over, setOver] = useState(false);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    depth.current += 1;
    setOver(true);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (!dragHasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setOver(false);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      if (!dragHasFiles(e)) return;
      e.preventDefault();
      e.stopPropagation();
      depth.current = 0;
      setOver(false);
      const files = filesFromDrag(e);
      if (files.length) onFiles(files, e);
    },
    [onFiles],
  );

  return { over, handlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
