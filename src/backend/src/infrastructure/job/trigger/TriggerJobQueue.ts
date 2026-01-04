import { JobQueue } from "../../../domain/interfaces/JobQueue";
import { tasks } from "@trigger.dev/sdk/v3"; 
import type { generateReportTask } from "./generateReport"; // Import the type only

export class TriggerJobQueue implements JobQueue {
    
    // We simplify the arguments. We don't need to list every single field here.
    async enqueueReportGeneration(
        projectId: string, 
        userId: string, 
        input: any // We can keep this loose here, or import the Interface if we want strictness
    ): Promise<void> {
        
        // The TYPE from the generic <typeof ...> provides the safety check!
        // If 'input' doesn't match what the Task expects, TypeScript will yell here.
        await tasks.trigger<typeof generateReportTask>("generate-report", {
            projectId,
            userId,
            input, // Pass the object through
        });

        console.log(`Triggered background job for project ${projectId}`);
    }
}