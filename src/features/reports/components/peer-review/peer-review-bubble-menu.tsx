"use client";

import type { Ref, RefObject } from "react";
import type { Editor } from "@tiptap/core";
import { BubbleMenu } from "@tiptap/react/menus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare, AlertCircle } from "lucide-react";

export function PeerReviewBubbleMenu({
  editor,
  onPeerReviewHighlightComment,
  peerCommentType,
  setPeerCommentType,
  peerCommentBubbleKey,
  peerCommentDraftRef,
  peerCommentSubmitting,
  onSubmit,
}: {
  editor: Editor;
  onPeerReviewHighlightComment?: unknown;
  peerCommentType: "comment" | "suggestion" | "issue";
  setPeerCommentType: (t: "comment" | "suggestion" | "issue") => void;
  peerCommentBubbleKey: number;
  peerCommentDraftRef: RefObject<HTMLTextAreaElement | null>;
  peerCommentSubmitting: boolean;
  onSubmit: () => void;
}) {
  return (
    <BubbleMenu
      editor={editor}
      options={{
        placement: "top",
        offset: 8,
      }}
      shouldShow={({ editor: ed, state }) => {
        if (!onPeerReviewHighlightComment) return false;
        const { from, to } = state.selection;
        if (from === to) return false;
        return ed.state.doc.textBetween(from, to).trim().length > 0;
      }}
    >
      <div
        className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl w-[min(92vw,680px)] min-w-[min(92vw,520px)] max-w-[680px]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <p className="text-xs font-medium text-slate-600">Leave a review comment</p>
        <div className="flex gap-1">
          <Button
            type="button"
            size="sm"
            variant={peerCommentType === "comment" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPeerCommentType("comment")}
          >
            <MessageSquare className="w-3 h-3 mr-1" />
            Comment
          </Button>
          <Button
            type="button"
            size="sm"
            variant={peerCommentType === "suggestion" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPeerCommentType("suggestion")}
          >
            Suggest
          </Button>
          <Button
            type="button"
            size="sm"
            variant={peerCommentType === "issue" ? "default" : "outline"}
            className="h-7 flex-1 text-xs"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setPeerCommentType("issue")}
          >
            <AlertCircle className="w-3 h-3 mr-1" />
            Issue
          </Button>
        </div>
        <Textarea
          key={peerCommentBubbleKey}
          ref={peerCommentDraftRef as Ref<HTMLTextAreaElement>}
          placeholder="Your feedback…"
          defaultValue=""
          rows={4}
          className="min-h-[88px] max-h-[160px] text-sm resize-y"
          onInput={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          disabled={peerCommentSubmitting}
        />
        <Button
          type="button"
          size="sm"
          className="w-full bg-theme-primary hover:bg-theme-primary-hover text-white"
          disabled={peerCommentSubmitting}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => void onSubmit()}
        >
          {peerCommentSubmitting ? "Saving…" : `Add ${peerCommentType}`}
        </Button>
      </div>
    </BubbleMenu>
  );
}
