"use client";

import { useCallback, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/core";

export function PeerSuggestionApplyOverlays({
  editor,
  appliedPeerSuggestionIds,
  onApplyPeerSuggestion,
}: {
  editor: Editor | null;
  appliedPeerSuggestionIds: Set<string>;
  onApplyPeerSuggestion: (commentId: string | number) => void;
}) {
  const [boxes, setBoxes] = useState<Array<{ id: string; left: number; top: number }>>([]);

  const layout = useCallback(() => {
    if (!editor) return;
    const root = editor.view.dom.closest(".peer-review-editor-root");
    if (!root) return;
    const els = root.querySelectorAll(".review-comment--suggestion[data-comment-id]");
    const next: Array<{ id: string; left: number; top: number }> = [];
    els.forEach((el) => {
      const id = el.getAttribute("data-comment-id");
      if (!id) return;
      const r = el.getBoundingClientRect();
      next.push({
        id,
        left: r.right + 8,
        top: r.top + r.height / 2 - 8,
      });
    });
    setBoxes(next);
  }, [editor]);

  useLayoutEffect(() => {
    layout();
    const raf = () => requestAnimationFrame(layout);
    window.addEventListener("scroll", raf, true);
    window.addEventListener("resize", raf);
    const ro = new ResizeObserver(raf);
    if (editor?.view.dom) ro.observe(editor.view.dom);
    const mo = new MutationObserver(raf);
    if (editor?.view.dom) mo.observe(editor.view.dom, { subtree: true, childList: true });
    return () => {
      window.removeEventListener("scroll", raf, true);
      window.removeEventListener("resize", raf);
      ro.disconnect();
      mo.disconnect();
    };
  }, [editor, layout, appliedPeerSuggestionIds]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      {boxes.map((b) => {
        const applied = appliedPeerSuggestionIds.has(b.id);
        return (
          <label
            key={b.id}
            className="pointer-events-auto fixed z-[10000] flex cursor-pointer items-center gap-1.5 rounded border border-green-600 bg-white px-1.5 py-0.5 text-[11px] font-medium text-green-900 shadow-md"
            style={{ left: b.left, top: b.top }}
          >
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-green-600"
              checked={applied}
              disabled={applied}
              title={applied ? "Applied — undo (Ctrl+Z) to clear" : "Apply suggested text"}
              aria-label="Apply peer suggestion"
              onChange={(e) => {
                if (e.target.checked && !applied) {
                  onApplyPeerSuggestion(b.id);
                }
              }}
            />
            <span className="select-none">Apply</span>
          </label>
        );
      })}
    </>,
    document.body,
  );
}
