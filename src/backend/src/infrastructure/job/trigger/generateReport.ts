import { task } from "@trigger.dev/sdk/v3";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad"; //not sending this
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
      const reportService = Container.reportService
      const repository = Container.projectRepo;
      console.log(`📥 Fetching Project data for ID: ${payload.projectId}...`);
      
      const project = await repository.getById(payload.projectId);
      // Delegate business logic to the service
      const finalReport = await reportService.generateNewReport(payload.projectId, payload.input);
     

      return finalReport;

    } catch (error) {
      console.error("❌ Report Generation Failed", { error });
      // Throwing error allows Trigger.dev to retry automatically
      throw error;
    }
  },
});