import { JobQueue } from "../../../domain/interfaces/JobQueue";
import { tasks } from "@trigger.dev/sdk/v3"; 
import type { generateReportTask } from "./generateReport"; // Import the type only

export class TriggerJobQueue implements JobQueue {
    
    async enqueueReportGeneration(
        projectId: string, 
        userId: string, 
        input: any,
        heliconeContext?: string,
    ): Promise<void> {
        
        await tasks.trigger<typeof generateReportTask>("generate-report", {
            projectId,
            userId,
            input,
            heliconeContext,
        });

        console.log(`Triggered background job for project ${projectId}`);
    }
}