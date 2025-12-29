import { task } from "@trigger.dev/sdk/v3";
import { ObservationReportWorkflow } from "../../../AI_Strategies/ReportWorkflows/ObservationReportWorkflow";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad";
import {Container} from '../../../config/container'

// 1. Define what the Queue sends (Lightweight)
export interface TriggerPayload {
  projectId: string;
  userId: string;
  input: {
    reportType: string;
    modelName: string;
    modeName: string;
    selectedImageIds: string[];
    templateId: string;
    instructions?: string;
  };
}

export const generateReportTask = task({
  id: "generate-report",
  // 1. Retry Settings: If AI fails randomly, try again twice.
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
    factor: 2,
    randomize: true,
  },
  run: async (payload: TriggerPayload, { ctx }) => {
    console.log("🚀 Starting Report Generation Task", { payload });

    try {
      // ---------------------------------------------------------
      // 1. DEPENDENCY INJECTION (The "Real" Implementation)
      // ---------------------------------------------------------
      // Here we instantiate the REAL tools, not the Mocks used in testing.
      const aiStrategy = Container.grokStrategy;
      const repository = Container.projectRepo;

      // ---------------------------------------------------------
      // 2. FETCH THE REAL PROJECT (The Missing Step!)
      // ---------------------------------------------------------
      // We use the ID from the payload to get the full object from Supabase
      console.log(`📥 Fetching Project data for ID: ${payload.projectId}...`);
      
      const project = await repository.getById(payload.projectId);

      // Guard Clause: Safety check in case the ID is wrong
      if (!project) {
        throw new Error(`CRITICAL: Project not found for ID ${payload.projectId}`);
      }

      // ---------------------------------------------------------
      // 2. INITIALIZE WORKFLOW
      // ---------------------------------------------------------
      const workflow = new ObservationReportWorkflow(aiStrategy, repository);

      // ---------------------------------------------------------
      // 3. EXECUTE (This handles Architect -> Writer -> Parallel Execution)
      // ---------------------------------------------------------
      const finalReport = await workflow.generateReport(project, payload);

      console.log("✅ Report Generated Successfully", { 
        reportId: finalReport.reportId,
        sectionCount: finalReport.sections.length 
      });

      return finalReport;

    } catch (error) {
      console.error("❌ Report Generation Failed", { error });
      // Throwing error allows Trigger.dev to retry automatically
      throw error;
    }
  },
});