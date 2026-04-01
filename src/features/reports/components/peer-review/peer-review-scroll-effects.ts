import { useCallback, useEffect, useState } from "react";
import type { PeerReviewComment } from "@/lib/types";

/**
 * Scrolls the document to a peer-review highlight when the user picks a comment in the panel.
 * Uses a nonce so repeated clicks on the same id still run the scroll effect.
 */
export function usePeerReviewHighlightScroll(comments: PeerReviewComment[] | undefined) {
  const [activeHighlightCommentId, setActiveHighlightCommentId] = useState<number | string | null>(null);
  const [highlightScrollNonce, setHighlightScrollNonce] = useState(0);

  const requestHighlightScroll = useCallback((commentId: number | string) => {
    setActiveHighlightCommentId(commentId);
    setHighlightScrollNonce((n) => n + 1);
  }, []);

  useEffect(() => {
    if (activeHighlightCommentId == null) return;
    const id = String(activeHighlightCommentId);
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 24;

    const tryScroll = () => {
      if (cancelled) return;
      const roots = document.querySelectorAll(
        ".peer-review-editor-root .review-comment[data-comment-id]",
      );
      for (const el of roots) {
        if (el.getAttribute("data-comment-id") === id) {
          el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
          return;
        }
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        requestAnimationFrame(tryScroll);
      }
    };

    requestAnimationFrame(tryScroll);
    const t = window.setTimeout(tryScroll, 50);
    const t2 = window.setTimeout(tryScroll, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
      window.clearTimeout(t2);
    };
  }, [activeHighlightCommentId, highlightScrollNonce]);

  useEffect(() => {
    if (activeHighlightCommentId == null) return;
    const list = comments;
    if (!list?.length) {
      setActiveHighlightCommentId(null);
      return;
    }
    const exists = list.some((c) => String(c.id) === String(activeHighlightCommentId));
    if (!exists) setActiveHighlightCommentId(null);
  }, [comments, activeHighlightCommentId]);

  return { activeHighlightCommentId, requestHighlightScroll };
}
