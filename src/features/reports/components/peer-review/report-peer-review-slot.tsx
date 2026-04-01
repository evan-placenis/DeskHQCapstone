"use client";

import { PeerReviewPanel } from "@/features/dashboard/components/peer-review-panel";
import type { PeerReview } from "@/lib/types";

export function ReportPeerReviewSlot({
  peerReview,
  onAddReviewComment,
  onAddHighlightComment,
  onResolveComment,
  onApplyPeerSuggestion,
  appliedPeerSuggestionIds,
  onHighlightClick,
  onCompleteReview,
  onOpenRatingModal,
}: {
  peerReview: PeerReview;
  onAddReviewComment: (comment: string, type: "issue" | "suggestion" | "comment") => void | Promise<void>;
  onAddHighlightComment: (
    highlightedText: string,
    sectionId: number | string,
    comment: string,
    type: "issue" | "suggestion" | "comment",
  ) => void | Promise<void | { id: string | number } | null>;
  onResolveComment: (commentId: number | string) => void | Promise<void>;
  onApplyPeerSuggestion?: (commentId: number | string) => void;
  appliedPeerSuggestionIds?: Set<string>;
  onHighlightClick: (commentId: number | string) => void;
  onCompleteReview: () => void;
  onOpenRatingModal: () => void;
}) {
  return (
    <PeerReviewPanel
      reviewerName={peerReview.assignedToName}
      requestedBy={peerReview.requestedByName}
      requestDate={peerReview.requestDate}
      requestNotes={peerReview.requestNotes}
      comments={peerReview.comments}
      onAddComment={onAddReviewComment}
      onAddHighlightComment={onAddHighlightComment}
      onResolveComment={onResolveComment}
      onApplyPeerSuggestion={onApplyPeerSuggestion}
      appliedPeerSuggestionIds={appliedPeerSuggestionIds}
      onHighlightClick={onHighlightClick}
      onCompleteReview={onCompleteReview}
      onOpenRatingModal={onOpenRatingModal}
      isCompleted={peerReview.status === "completed"}
    />
  );
}
