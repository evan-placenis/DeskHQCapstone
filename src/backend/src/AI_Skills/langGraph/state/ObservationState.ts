import { BaseMessage } from "@langchain/core/messages";

export interface ObservationReportState {
  // Standard Fields
  messages: BaseMessage[];
  projectId: string;
  reportId: string;
  
  // Inputs
  photoNotes: string[]; // Notes attached to photos
  structureRules: string; // "Must have header X, Y..."
  
  // THE PLAN (The critical part)
  reportPlan: {
    sections: {
      title: string;
      photoIds: string[];
      keyPoints: string[];
    }[];
  } | null;

  // The Drafts
  sectionDrafts: Record<string, string>; // { "Roof": "The roof is..." }
  
  // Feedback Loop
  userFeedback: string | null; // "Move photo A to section B"
  approved: boolean;
}