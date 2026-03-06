import { BaseMessage } from "@langchain/core/messages";
import { Annotation } from "@langchain/langgraph";
import { ReportPlan, ImageContext  } from "@/app/shared/types/report-schemas";
 

/**
 * Extended State for Observation Report Generation
 * Supports the "Plan-Approve-Execute-Review" workflow
 */
export const ObservationState = Annotation.Root({
  // 1. Core Context (inherited concept from TeamState)

  systemPrompt: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  structureInstructions: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "",
  }),

  messages: Annotation<BaseMessage[]>({
    reducer: (x, y) => {
      // Allow resume flow to replace messages so the builder isn't confused by full history
      if (y && typeof y === "object" && !Array.isArray(y) && "__replace" in (y as object) && (y as { __replace: boolean }).__replace) {
        return ((y as { __replace: boolean; value: BaseMessage[] }).value) ?? x;
      }
      return x.concat(Array.isArray(y) ? y : []);
    },
    default: () => [],
  }),

  additionalContextFromTools: Annotation<string>({
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

  /** 'TEXT_ONLY' = no vision tools; 'IMAGE_AND_TEXT' = include analyze_batch_images etc. (from NewReportModal) */
  processingMode: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "IMAGE_AND_TEXT",
  }),

  // 2. Inputs for Architect Phase
  selectedImageIds: Annotation<string[]>({
    reducer: (x, y) => y ?? x,
    default: () => [],
  }),

  // ✅ NEW: The Source of Truth for Image Data which includes photo notes from the user/audio
  imageList: Annotation<ImageContext[]>({
    reducer: (x, y) => y ?? x, // Overwrite with new list if updated
    default: () => [],
  }),

  // photoNotes: Annotation<string>({
  //   reducer: (x, y) => y ?? x,
  //   default: () => "",
  // }),

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

  // 9b. Circuit breaker: count search tool invocations per section to avoid infinite loops
  searchAttemptCount: Annotation<number>({
    reducer: (x, y) => (y !== undefined && y !== null ? y : x),
    default: () => 0,
  }),

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
