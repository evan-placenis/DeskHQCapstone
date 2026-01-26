import { Project } from "../../domain/core/project.types"
import { SupabaseClient } from "@supabase/supabase-js";
import { ExecutionPlan } from "../ChatSystem/interfaces";

// --- 1. The Brain Contract ---
// Every AI model MUST have a generateContent method.
export interface AgentStrategy {
  generateContent(
    systemPrompt: string,
    userMessage: string,
    context?: AgentExecutionContext,
    onStream?: (chunk: string) => void // Optional streaming callback
  ): Promise<string>;
}

// --- 2. The Eyes Contract ---
// Every input mode MUST have a prepareInput method.
export interface ExecutionModeStrategy {
  prepareInput(context: AgentExecutionContext): Promise<any>; // 'any' represents the prompt payload
}


// --- 3. The Vision Contract (Image Analysis) ---
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

export type StreamEventType = 'status' | 'reasoning' | 'review_reasoning' | 'final_content';

export interface StreamEvent {
  type: StreamEventType;
  content: string;
  metadata?: any;
}

// The "Briefcase" of data passed to the AI
export class AgentExecutionContext {
  public project: Project;
  public selectedImages: string[]; // URLs or IDs
  public retrievedContext: string[]; // Text chunks found via RAG
  public templateId: any; // The report structure
  public payload: any;
  public client?: SupabaseClient; // Optional to avoid breaking tests/other uses temporarily

  // Callback for streaming updates back to the caller (Service -> Controller -> Frontend)
  public onStream?: (event: StreamEvent) => void;

  constructor(
    project: Project,
    selectedImages: string[],
    retrievedContext: string[],
    templateId: any,
    payload: any,
    client?: SupabaseClient,
    onStream?: (event: StreamEvent) => void
  ) {
    this.project = project;
    this.selectedImages = selectedImages;
    this.retrievedContext = retrievedContext;
    this.templateId = templateId;
    this.payload = payload;
    this.client = client;
    this.onStream = onStream;
  }

  // Helper to emit events safely
  public emit(type: StreamEventType, content: string, metadata?: any) {
    if (this.onStream) {
      this.onStream({ type, content, metadata });
    }
  }
}
