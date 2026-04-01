import type { Editor } from "@tiptap/core";
import type { PeerReviewComment } from "@/lib/types";
import {
  findTextRangeInDocument,
  findTextRangeInSingleNode,
} from "@/features/reports/components/peer-review/peer-review-comment-mark";

export function setsEqualString(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

/** After undo, original highlighted text reappears — clear "applied" for that suggestion. */
export function reconcileAppliedPeerSuggestionIds(
  editor: Editor,
  peerReviewComments: PeerReviewComment[],
  appliedIds: Set<string>,
): Set<string> {
  const next = new Set(appliedIds);
  for (const id of appliedIds) {
    const c = peerReviewComments.find((x) => String(x.id) === String(id));
    if (!c || c.type !== "suggestion" || !c.highlightedText?.trim()) {
      next.delete(id);
      continue;
    }
    const doc = editor.state.doc;
    const range =
      findTextRangeInSingleNode(doc, c.highlightedText) ??
      findTextRangeInDocument(doc, c.highlightedText);
    if (!range) continue;
    const text = doc.textBetween(range.from, range.to);
    if (text.trim() === c.highlightedText.trim()) {
      next.delete(id);
    }
  }
  return next;
}
