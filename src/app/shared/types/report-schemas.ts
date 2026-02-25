import { z } from 'zod';

/**
 * Report Plan Structure
 * The Architect creates this in Phase 1
 */
// 1. Define the Context Item (The "Tuple")
// This represents { photoId: "uuid", note: "Look at the crack" }
const PhotoContextItemSchema = z.object({
  photoId: z.string(),
  note: z.string()
});

// 1. Define the Zod Schema (Runtime Validation)
export const ReportSubsectionSchema = z.object({
  subSectionId: z.string(),
  title: z.string(),
  photoContext: z.array(PhotoContextItemSchema).optional(),
  assignedPhotoIds: z.array(z.string()).optional(), // Deprecated: derived from photoContext for backward compat
  purpose: z.string().optional()
});

export const ReportSectionSchema = z.object({
  sectionId: z.string(),
  title: z.string(),
  photoContext: z.array(PhotoContextItemSchema).optional(),
  assignedPhotoIds: z.array(z.string()).optional(), // Deprecated: derived from photoContext for backward compat
  reportOrder: z.number(), // The sorting field
  purpose: z.string().optional(),
  subsections: z.array(ReportSubsectionSchema).optional()
});

export const ReportPlanSchema = z.object({
  sections: z.array(ReportSectionSchema),
  strategy: z.string(),
  reasoning: z.string().optional()
});

export interface ImageContext {
  id: string;
  url: string; // Useful if a Builder needs to "look" again
  tags: string[];
  severity: 'Low' | 'Medium' | 'High' | 'Critical' | 'None';
  aiDescription: string; // The full 2,000 token markdown
  userNote?: string;     // The human caption from the DB
}

// 2. Export the Types (Compile-time Types)
// z.infer<typeof X> automatically creates the TS interface for you!
export type ReportSubsection = z.infer<typeof ReportSubsectionSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportPlan = z.infer<typeof ReportPlanSchema>;