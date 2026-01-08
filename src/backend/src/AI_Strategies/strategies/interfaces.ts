import {Project} from "../../domain/core/project.types"
import { SupabaseClient } from "@supabase/supabase-js";

// --- 1. The Brain Contract ---
// Every AI model MUST have a generateContent method.
export interface AgentStrategy {
  generateContent(systemPrompt: string, userMessage: string, context: AgentExecutionContext): Promise<string>;
}

// --- 2. The Eyes Contract ---
// Every input mode MUST have a prepareInput method.
export interface ExecutionModeStrategy {
  prepareInput(context: AgentExecutionContext): any; // 'any' represents the prompt payload
}

// The "Briefcase" of data passed to the AI
export class AgentExecutionContext {
  public project: Project;
  public selectedImages: string[]; // URLs or IDs
  public retrievedContext: string[]; // Text chunks found via RAG
  public templateId: any; // The report structure
  public payload: any;
  public client?: SupabaseClient; // Optional to avoid breaking tests/other uses temporarily

  constructor(
    project: Project,
    selectedImages: string[],
    retrievedContext: string[],
    templateId: any,
    payload: any,
    client?: SupabaseClient
  ) {
    this.project = project;
    this.selectedImages = selectedImages;
    this.retrievedContext = retrievedContext;
    this.templateId = templateId;
    this.payload = payload;
    this.client = client;
  }
}
