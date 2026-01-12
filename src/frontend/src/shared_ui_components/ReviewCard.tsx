import React from 'react';
import ReactDiffViewer from 'react-diff-viewer-continued';

interface ReviewCardProps {
  originalText: string;
  suggestedText: string;
  reason?: string;
  onAccept: () => void;
  onReject: () => void;
}

export const ReviewCard: React.FC<ReviewCardProps> = ({
  originalText,
  suggestedText,
  reason,
  onAccept,
  onReject
}) => {
  return (
    <div className="border rounded-lg p-4 bg-card shadow-sm my-4">
      <div className="mb-2 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-muted-foreground">Suggested Change</h3>
        {reason && <span className="text-xs bg-muted px-2 py-1 rounded">{reason}</span>}
      </div>
      
      <div className="border rounded overflow-hidden text-xs">
        <ReactDiffViewer 
          oldValue={originalText} 
          newValue={suggestedText} 
          splitView={true} 
          useDarkTheme={false}
          styles={{
            variables: {
              light: {
                diffViewerBackground: '#fff',
                gutterBackground: '#f9f9f9',
              }
            }
          }}
        />
      </div>

      <div className="mt-4 flex gap-2 justify-end">
        <button 
          onClick={onReject}
          className="px-3 py-1.5 text-sm border rounded hover:bg-muted transition-colors"
        >
          Reject
        </button>
        <button 
          onClick={onAccept}
          className="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Accept Change
        </button>
      </div>
    </div>
  );
};
