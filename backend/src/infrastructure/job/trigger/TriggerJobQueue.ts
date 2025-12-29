import { JobQueue } from "../../../domain/interfaces/JobQueue";
import { tasks } from "@trigger.dev/sdk/v3"; // 👈 Import 'tasks', not 'client'
import type { generateReportTask } from "./generateReport"; // Import the type for type-safety

export class TriggerJobQueue implements JobQueue {
    async enqueueReportGeneration(
        projectId: string, 
        userId: string, 
        input: {               // 👈 This matches your Interface
            reportType: string;
            modelName: string;
            modeName: string;
            selectedImageIds: string[];
            templateId: string;
        }
    ): Promise<void> {
        
        // v3 Syntax: Trigger by ID
        await tasks.trigger<typeof generateReportTask>("generate-report", {
            projectId,
            userId,
            input
        });

        console.log(`Triggered background job for project ${projectId}`);
    }
}