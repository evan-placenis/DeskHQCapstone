import { z } from 'zod';

/**
 * Report Plan Structure
 * The Architect creates this in Phase 1
 */

// 1. Define the Zod Schema (Runtime Validation)
export const ReportSubsectionSchema = z.object({
  subSectionId: z.string(),
  title: z.string(),
  assignedPhotoIds: z.array(z.string()),
  purpose: z.string().optional()
});

export const ReportSectionSchema = z.object({
  sectionId: z.string(),
  title: z.string(),
  assignedPhotoIds: z.array(z.string()).optional(),
  reportOrder: z.number(), // The sorting field
  purpose: z.string().optional(),
  subsections: z.array(ReportSubsectionSchema).optional()
});

export const ReportPlanSchema = z.object({
  sections: z.array(ReportSectionSchema),
  strategy: z.string(),
  reasoning: z.string().optional()
});

// 2. Export the Types (Compile-time Types)
// z.infer<typeof X> automatically creates the TS interface for you!
export type ReportSubsection = z.infer<typeof ReportSubsectionSchema>;
export type ReportSection = z.infer<typeof ReportSectionSchema>;
export type ReportPlan = z.infer<typeof ReportPlanSchema>;