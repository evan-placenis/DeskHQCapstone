import { useState } from "react";
import { Button } from "../ui_components/button";
import { Textarea } from "../ui_components/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../ui_components/dialog";
import { Star, CheckCircle2 } from "lucide-react";

interface RatingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportTitle: string;
  onSubmitReview: (rating: number, feedback: string) => void;
}

export function RatingModal({ 
  open, 
  onOpenChange, 
  reportTitle,
  onSubmitReview 
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");

  const handleSubmit = () => {
    if (rating > 0) {
      onSubmitReview(rating, feedback);
      // Reset form
      setRating(0);
      setHoveredRating(0);
      setFeedback("");
      onOpenChange(false);
    }
  };

  const getRatingLabel = (ratingValue: number) => {
    switch (ratingValue) {
      case 1:
        return "Poor - Significant issues need addressing";
      case 2:
        return "Fair - Multiple improvements needed";
      case 3:
        return "Good - Minor improvements suggested";
      case 4:
        return "Very Good - Well written with few issues";
      case 5:
        return "Excellent - Outstanding quality";
      default:
        return "Select a rating";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
            Submit Review
          </DialogTitle>
          <DialogDescription>
            Rate the quality of <span className="font-medium text-slate-700">{reportTitle}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Star Rating */}
          <div className="space-y-3">
            <label className="text-sm text-slate-700">Quality Rating</label>
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="transition-transform hover:scale-110 focus:outline-none"
                >
                  <Star
                    className={`w-10 h-10 transition-colors ${
                      star <= (hoveredRating || rating)
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-slate-300"
                    }`}
                  />
                </button>
              ))}
            </div>
            <p className={`text-sm transition-colors ${
              (hoveredRating || rating) > 0 ? "text-slate-700" : "text-slate-500"
            }`}>
              {getRatingLabel(hoveredRating || rating)}
            </p>
          </div>

          {/* Feedback Text */}
          <div className="space-y-2">
            <label htmlFor="feedback" className="text-sm text-slate-700">
              Additional Feedback <span className="text-slate-500">(Optional)</span>
            </label>
            <Textarea
              id="feedback"
              placeholder="Share your overall thoughts on the report quality..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              className="rounded-lg resize-none min-h-[100px]"
            />
            <p className="text-xs text-slate-500">
              Your rating and feedback will be shared with the report author
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="rounded-lg"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={rating === 0}
            className="bg-green-600 hover:bg-green-700 rounded-lg"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Submit Review
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
