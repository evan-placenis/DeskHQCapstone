import { Mark, mergeAttributes } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";

/**
 * Wraps reviewed spans with a stable mark so highlights survive edits around/in the text.
 * Renders as: <span class="review-comment" data-comment-id="…">…</span>
 */
export const PeerReviewCommentMark = Mark.create({
  name: "peerReviewComment",

  inclusive: false,

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (element) => element.getAttribute("data-comment-id"),
        renderHTML: (attributes) => {
          if (attributes.commentId == null) return {};
          return { "data-comment-id": String(attributes.commentId) };
        },
      },
      commentType: {
        default: "comment",
        parseHTML: (element) =>
          element.getAttribute("data-comment-type") || "comment",
        renderHTML: (attributes) => {
          const t = attributes.commentType || "comment";
          return { "data-comment-type": String(t) };
        },
      },
      resolved: {
        default: "false",
        parseHTML: (element) =>
          element.getAttribute("data-resolved") === "true" ? "true" : "false",
        renderHTML: (attributes) => ({
          "data-resolved": attributes.resolved === "true" ? "true" : "false",
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: "span.review-comment[data-comment-id]" },
      { tag: 'span[data-type="peer-review-comment"]' },
    ];
  },

  renderHTML({ HTMLAttributes, mark }) {
    const type = (mark.attrs.commentType as string) || "comment";
    const typeClass =
      type === "issue"
        ? "review-comment--issue"
        : type === "suggestion"
          ? "review-comment--suggestion"
          : "review-comment--comment";
    return [
      "span",
      mergeAttributes(
        {
          class: `review-comment ${typeClass}`,
          "data-type": "peer-review-comment",
        },
        this.options.HTMLAttributes,
        HTMLAttributes,
      ),
      0,
    ];
  },

  addCommands() {
    return {
      setPeerReviewComment:
        (attributes: {
          commentId: string | number;
          commentType?: "comment" | "suggestion" | "issue";
          resolved?: boolean | string;
        }) =>
        ({ commands }) => {
          return commands.setMark(this.name, {
            ...attributes,
            commentType: attributes.commentType ?? "comment",
            resolved:
              attributes.resolved === true || attributes.resolved === "true"
                ? "true"
                : "false",
          });
        },
      togglePeerReviewComment:
        () =>
        ({ commands }) => {
          return commands.toggleMark(this.name);
        },
      unsetPeerReviewComment:
        () =>
        ({ commands }) => {
          return commands.unsetMark(this.name);
        },
    };
  },
});

/** Find first occurrence of `search` within a single text node (covers most highlights). */
export function findTextRangeInSingleNode(
  doc: ProseMirrorNode,
  search: string,
): { from: number; to: number } | null {
  if (!search) return null;
  let found: { from: number; to: number } | null = null;
  doc.descendants((node, pos) => {
    if (found || !node.isText || !node.text) return;
    const idx = node.text.indexOf(search);
    if (idx !== -1) {
      found = { from: pos + idx, to: pos + idx + search.length };
    }
  });
  return found;
}

/** Smallest doc position `pos` such that `doc.textBetween(0, pos).length >= charCount` (matches PM `textBetween` rules). */
function posAtFlattenedTextLength(doc: ProseMirrorNode, charCount: number): number {
  let lo = 0;
  let hi = doc.content.size;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const len = doc.textBetween(0, mid).length;
    if (len < charCount) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/**
 * Find `search` in the same flattened string as `doc.textBetween(0, doc.content.size)` and map to doc positions.
 * Use when the highlight spans multiple text nodes (e.g. line breaks).
 */
export function findTextRangeInDocument(doc: ProseMirrorNode, search: string): { from: number; to: number } | null {
  const single = findTextRangeInSingleNode(doc, search);
  if (single) return single;
  if (!search) return null;
  const full = doc.textBetween(0, doc.content.size);
  const idx = full.indexOf(search);
  if (idx === -1) return null;
  const from = posAtFlattenedTextLength(doc, idx);
  const to = posAtFlattenedTextLength(doc, idx + search.length);
  if (from < to) return { from, to };
  return null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    peerReviewComment: {
      setPeerReviewComment: (attributes: {
        commentId: string | number;
        commentType?: "comment" | "suggestion" | "issue";
        resolved?: boolean | string;
      }) => ReturnType;
      togglePeerReviewComment: () => ReturnType;
      unsetPeerReviewComment: () => ReturnType;
    };
  }
}
