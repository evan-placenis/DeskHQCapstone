
// --- 1. The Vision Contract (Image Analysis) ---
// New interface for the Vision Agent to implement. 
// This decouples your specific provider (GPT-4o) from the rest of your app.
export interface VisionStrategy {
  /**
   * Analyzes a single image and returns a description.
   */
  analyzeImage(imageUrl: string, imageId?: string): Promise<VisionAnalysis>;

  /**
   * Batch processes images with concurrency control.
   */
  analyzeBatch(
    images: { id: string; url: string }[],
    concurrencyLimit?: number
  ): Promise<VisionAnalysis[]>;
}

// Define the shape of your analysis result
export interface VisionAnalysis {
  imageId: string;
  description: string;
  timestamp: string;
}

