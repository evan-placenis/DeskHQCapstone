import { task } from "@trigger.dev/sdk/v3";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad"; //not sending this
import {Container} from '../../../config/container'
import { StreamEvent } from "../../../AI_Strategies/strategies/interfaces";

// 1. Define what the Queue sends (Lightweight)
export interface TriggerPayload {
  projectId: string;
  userId: string;
  input: {
    reportType: string;
    reportWorkflow: string; // Add reportWorkflow
    modelName: string;
    modeName: string;
    selectedImageIds: string[];
    templateId: string;
    instructions?: string;
    sections?: any[]; // Add sections
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
    
    // Create a Supabase client just for this task (to write updates)
    // We assume env vars are available in the Trigger.dev environment
    const supabase = Container.adminClient;

    // Buffer for batching updates
    let updateBuffer = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 500; // ms (update every 0.5 seconds)

    try {
      const reportService = Container.reportService
      const repository = Container.projectRepo;
      console.log(`📥 Fetching Project data for ID: ${payload.projectId}...`);
      
      const project = await repository.getById(payload.projectId, supabase);
      
      // Delegate business logic to the service
      // Pass the Streaming Callback!
      const finalReport = await reportService.generateNewReport(
          payload.projectId, 
          payload.input, 
          supabase,
          async (event: StreamEvent) => {
              // 🟢 OPTION A: Batching Logic with Persistent Table
              // We now write to the 'report_events' table so the UI can subscribe to it.
              
              const now = Date.now();

              // 1. HANDLING STATUS UPDATES (Always Write)
              if (event.type === 'status') {
                   // We write a row for every status change
                   // Using Broadcast for now as discussed to avoid the ID chicken-and-egg problem
                   await supabase.channel(`project-${payload.projectId}`).send({
                      type: 'broadcast',
                      event: 'status',
                      payload: { 
                          chunk: event.content,
                          projectId: payload.projectId
                      }
                  });
              } 

              // 2. HANDLING REASONING (The heavy stream)
              if (event.type === 'reasoning' || event.type === 'review_reasoning') {
                  updateBuffer += event.content;
                  
                  if (now - lastUpdate > UPDATE_INTERVAL) {
                      const chunk = updateBuffer;
                      updateBuffer = ""; 
                      lastUpdate = now;
                      
                      // Broadcast chunk to frontend via Channel
                      // Channel Name: `project-[projectId]`
                      await supabase.channel(`project-${payload.projectId}`).send({
                          type: 'broadcast',
                          event: event.type, 
                          payload: { 
                              chunk: chunk,
                              projectId: payload.projectId
                          }
                      });
                  }
              }
          }
      );
     
      // Flush any remaining buffer
      if (updateBuffer.length > 0) {
          await supabase.channel(`project-${payload.projectId}`).send({
              type: 'broadcast',
              event: 'reasoning', 
              payload: { chunk: updateBuffer }
          });
      }

      // 🟢 BROADCAST COMPLETION
      // This tells the frontend to redirect
      await supabase.channel(`project-${payload.projectId}`).send({
          type: 'broadcast',
          event: 'report_complete',
          payload: { 
              reportId: finalReport.reportId,
              projectId: payload.projectId
          }
      });

      return finalReport;

    } catch (error) {
      console.error("❌ Report Generation Failed", { error });
      
      // Broadcast Error
      await supabase.channel(`project-${payload.projectId}`).send({
          type: 'broadcast',
          event: 'error',
          payload: { 
              message: error instanceof Error ? error.message : "Unknown error occurred",
              projectId: payload.projectId
          }
      });

      throw error;
    }
  },
});
