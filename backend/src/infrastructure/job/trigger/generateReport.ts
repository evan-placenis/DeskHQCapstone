import { task } from "@trigger.dev/sdk/v3";
import { Container } from "../../../config/container"; // Adjust path to reach your Container
import {ReportPayLoad} from "../../../domain/interfaces/ReportPayload"

export const generateReportTask = task({
  id: "generate-report",
  // v3 lets you set limits right here!
  retry: {
    maxAttempts: 3,
  },
  run: async (payload: ReportPayLoad, { ctx }) => {
    console.log(`Processing report for project ${payload.projectId}`);

    // 1. Get Service from Container
    // (Ensure your Container initializes properly in this isolated environment)
    const reportService = Container.reportService;

    // 2. Call the service matching its EXACT signature
    const report = await reportService.generateNewReport(
        payload.projectId, 
        payload.input // Pass the object, not separate strings
    );
    return report;
  },
});