// src/backend/src/interfaces/vision.interfaces.ts

// 1. The Input is always the same
export interface VisionRequest {
  id: string;
  url: string;
  description?: string; // Optional user-provided description to guide AI analysis
}

// 2. The Base Result (Standard fields everyone has)
export interface BaseVisionResult {
  imageId: string;
  timestamp: string;
  error?: string; // Optional error field is always good practice
}

// 3. The Specific Result Types
// For Specs (Text only)
export interface SpecAnalysisResult extends BaseVisionResult {
  description: string;
}

// For Site Photos (Rich Data)
export interface SitePhotoResult extends BaseVisionResult {
  description: string; // The Markdown text
  tags: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | 'None';
}

// 4. The Generic Strategy Interface
// T extends BaseVisionResult means "T must have at least an imageId and timestamp"
export interface VisionStrategy<T extends BaseVisionResult> {
  
  analyzeImage(imageUrl: string, imageId?: string): Promise<T>;

  analyzeBatch(
    images: VisionRequest[],
    concurrencyLimit?: number
  ): Promise<T[]>;
}