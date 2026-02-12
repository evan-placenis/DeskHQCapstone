import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { ReportPlan } from "@/app/shared/types/report-schemas";


/**
 * Extended State for Observation Report Generation
 * Supports the "Plan-Approve-Execute-Review" workflow
 */
export const ObservationState = Annotation.Root({
  // 1. Core Context (inherited concept from TeamState)
  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => x.concat(y),
    default: () => [],
  }),

  context: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  projectId: Annotation<string>(),
  userId: Annotation<string>(),
  reportType: Annotation<string>(),
  provider: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "gemini-cheap",
  }),

  // 2. Inputs for Architect Phase
  selectedImageIds: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  photoNotes: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  structureInstructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  // 3. Phase 1: Architect Outputs
  reportPlan: Annotation<ReportPlan | null>({
    reducer: (x, y) => y ?? x,
    default: () => null,
  }),

  // 4. Phase 2: Human Approval
  approvalStatus: Annotation<'PENDING' | 'APPROVED' | 'REJECTED'>({
    reducer: (x, y) => y ?? x,
    default: () => 'PENDING',
  }),

  userFeedback: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  // 5. Phase 3: Builder Outputs
  sectionDrafts: Annotation<Record<string, string>>({
    reducer: (x, y) => ({ ...x, ...y }), // Merge new sections into existing
    default: () => ({}),
  }),

  currentSectionIndex: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),

  builderRetries: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),

  // 6. Phase 4: Reviewer Outputs
  critiqueNotes: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  reviewScore: Annotation<number>({
    reducer: (x, y) => y ?? x,
    default: () => 0,
  }),

  // 7. Routing Control
  next_step: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "architect",
  }),

  // 8. Report Artifacts
  draftReportId: Annotation<string | undefined>(),

  // 9. Supabase Client (non-serializable but needed for tools)
  client: Annotation<any>(),

  // 10. Shared Knowledge Base (populated by researcher)
  researchFindings: Annotation<string>({
    reducer: (x, y) => {
      // Append new findings to existing
      if (!x) return y;
      if (!y) return x;
      return x + '\n\n---\n\n' + y;
    },
    default: () => "",
  }),

  // 11. Compliance Specifications (building codes, standards, etc.)
  complianceSpec: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),
});
