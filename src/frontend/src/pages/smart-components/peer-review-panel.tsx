"use client";

import { useState } from "react";
import { Button } from "../ui_components/button";
import { Badge } from "../ui_components/badge";
import { Textarea } from "../ui_components/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../ui_components/card";
import { Avatar, AvatarFallback } from "../ui_components/avatar";
import { Separator } from "../ui_components/separator";
import { 
  UserCheck, 
  MessageSquare, 
  CheckCircle2, 
  Clock, 
  Send, 
  AlertCircle 
} from "lucide-react";
import { PeerReviewComment } from "@/frontend/types";

interface PeerReviewPanelProps {
  reviewerName: string;
  requestedBy: string;
  requestDate: string;
  requestNotes?: string;
  comments: PeerReviewComment[];
  onAddComment: (comment: string, type: PeerReviewComment["type"]) => void;
  onAddHighlightComment?: (highlightedText: string, sectionId: number, comment: string, type: PeerReviewComment["type"]) => void;
  onCompleteReview: () => void;
  onResolveComment?: (commentId: number) => void; // New prop to resolve comments
  onHighlightClick?: (commentId: number) => void; // New prop to scroll to highlight
  onOpenRatingModal?: () => void; // New prop to open rating modal
  isCompleted?: boolean;
}

export function PeerReviewPanel({
  reviewerName,
  requestedBy,
  requestDate,
  requestNotes,
  comments,
  onAddComment,
  onAddHighlightComment,
  onCompleteReview,
  onResolveComment,
  onHighlightClick,
  onOpenRatingModal,
  isCompleted = false,
}: PeerReviewPanelProps) {
  const [newComment, setNewComment] = useState("");
  const [commentType, setCommentType] = useState<PeerReviewComment["type"]>("comment");

  // Calculate unresolved counts
  const unresolvedIssues = comments.filter(c => c.type === "issue" && !c.resolved).length;
  const unresolvedSuggestions = comments.filter(c => c.type === "suggestion" && !c.resolved).length;

  const handleSubmitComment = () => {
    if (newComment.trim()) {
      onAddComment(newComment, commentType);
      setNewComment("");
      setCommentType("comment");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getCommentIcon = (type: PeerReviewComment["type"]) => {
    switch (type) {
      case "suggestion":
        return <MessageSquare className="w-4 h-4 text-theme-primary" />;
      case "issue":
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      default:
        return <MessageSquare className="w-4 h-4 text-slate-600" />;
    }
  };

  const getCommentBadgeColor = (type: PeerReviewComment["type"]) => {
    switch (type) {
      case "suggestion":
        return "bg-theme-primary-20 text-theme-primary";
      case "issue":
        return "bg-red-100 text-red-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <Card className="rounded-xl shadow-sm border-2 border-theme-primary-30 bg-theme-primary-10">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-theme-primary" />
              Peer Review
              {isCompleted && (
                <Badge className="bg-green-600 text-white rounded-md">
                  <CheckCircle2 className="w-3 h-3 mr-1" />
                  Completed
                </Badge>
              )}
            </CardTitle>
            <CardDescription className="mt-1">
              Requested by <span className="font-semibold">{requestedBy}</span> on {requestDate}
            </CardDescription>
          </div>
          {!isCompleted && onOpenRatingModal && (
            <Button
              onClick={onOpenRatingModal}
              className="bg-green-600 hover:bg-green-700 rounded-lg"
              size="sm"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Submit Review
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Request Notes */}
        {requestNotes && (
          <div className="bg-white border border-slate-200 rounded-lg p-3">
            <h4 className="text-sm text-slate-900 mb-2 flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-600" />
              Request Notes
            </h4>
            <p className="text-sm text-slate-700 italic">"{requestNotes}"</p>
          </div>
        )}

        <Separator />

        {/* Comments Section */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h4 className="text-sm text-slate-900 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-slate-600" />
              Review Comments ({comments.length})
            </h4>
            {unresolvedIssues > 0 && (
              <Badge className="bg-red-100 text-red-700 rounded-md text-xs">
                <AlertCircle className="w-3 h-3 mr-1" />
                {unresolvedIssues} Issue{unresolvedIssues !== 1 ? 's' : ''}
              </Badge>
            )}
            {unresolvedSuggestions > 0 && (
              <Badge className="bg-theme-primary-20 text-theme-primary rounded-md text-xs">
                <MessageSquare className="w-3 h-3 mr-1" />
                {unresolvedSuggestions} Suggestion{unresolvedSuggestions !== 1 ? 's' : ''}
              </Badge>
            )}
          </div>

          {comments.length > 0 ? (
            <div className="space-y-3 mb-4">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`bg-white border rounded-lg p-3 transition-all ${
                    comment.resolved 
                      ? 'border-green-200 bg-green-50/30 opacity-75' 
                      : 'border-slate-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Resolve Checkbox */}
                    {onResolveComment && !isCompleted && (
                      <button
                        onClick={() => onResolveComment(comment.id)}
                        className={`mt-1 flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                          comment.resolved
                            ? 'bg-green-500 border-green-500'
                            : 'border-slate-300 hover:border-green-500 hover:bg-green-50'
                        }`}
                        title={comment.resolved ? "Resolved" : "Mark as resolved"}
                      >
                        {comment.resolved && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        )}
                      </button>
                    )}

                    <Avatar className="bg-theme-primary flex-shrink-0 w-8 h-8">
                      <AvatarFallback className="text-white text-xs">
                        {getInitials(comment.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-sm text-slate-900">{comment.userName}</span>
                        <Badge className={`text-xs rounded-md ${getCommentBadgeColor(comment.type)}`}>
                          {comment.type}
                        </Badge>
                        {comment.resolved && (
                          <Badge className="text-xs rounded-md bg-green-100 text-green-700">
                            Resolved
                          </Badge>
                        )}
                        <span className="text-xs text-slate-500">{comment.timestamp}</span>
                      </div>
                      
                      {/* Highlighted Text */}
                      {comment.highlightedText && (
                        <div 
                          className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded cursor-pointer hover:bg-yellow-100 transition-colors"
                          onClick={() => onHighlightClick?.(comment.id)}
                          title="Click to view in report"
                        >
                          <p className="text-xs text-slate-500 mb-1">Highlighted text:</p>
                          <p className="text-sm text-slate-700 italic line-clamp-2">"{comment.highlightedText}"</p>
                        </div>
                      )}
                      
                      <p className="text-sm text-slate-700">{comment.comment}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-6 text-center mb-4">
              <MessageSquare className="w-8 h-8 text-slate-400 mx-auto mb-2" />
              <p className="text-sm text-slate-600">No comments yet. Add your first review comment below.</p>
            </div>
          )}

          {/* Add Comment Form */}
          {!isCompleted && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={commentType === "comment" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setCommentType("comment")}
                  className="rounded-lg"
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Comment
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCommentType("suggestion")}
                  className={`rounded-lg ${
                    commentType === "suggestion"
                      ? "bg-theme-primary hover:bg-theme-primary-hover text-white border-theme-primary"
                      : ""
                  }`}
                >
                  <MessageSquare className="w-3 h-3 mr-1" />
                  Suggestion
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCommentType("issue")}
                  className={`rounded-lg ${
                    commentType === "issue"
                      ? "bg-red-600 hover:bg-red-700 text-white border-red-600"
                      : ""
                  }`}
                >
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Issue
                </Button>
              </div>

              <Textarea
                placeholder={`Add a ${commentType}...`}
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="rounded-lg resize-none"
                rows={3}
              />

              <div className="flex justify-end">
                <Button
                  onClick={handleSubmitComment}
                  disabled={!newComment.trim()}
                  className="bg-theme-primary hover:bg-theme-primary-hover text-white rounded-lg"
                  size="sm"
                >
                  <Send className="w-3 h-3 mr-2" />
                  Add {commentType}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Completion Info */}
        {isCompleted && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
            <p className="text-sm text-green-900">
              Review completed. The report author has been notified of your feedback.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}