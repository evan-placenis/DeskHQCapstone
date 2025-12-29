export interface JobQueue {
    enqueueReportGeneration(
        projectId: string, 
        userId: string, 

        input: {
            reportType: string;
            modelName: string;
            modeName: string;
            selectedImageIds: string[];
            templateId: string;
        }
    ): Promise<void>;
}