export interface JobQueue {
    enqueueReportGeneration(
        projectId: string, 
        userId: string, 
        input: {
            reportType: string;
            modelName: string;
            modeName?: string;
            selectedImageIds: string[];
            templateId: string;
            jobInfoSheet?: Record<string, unknown>;
        },
        heliconeContext?: string,
    ): Promise<void>;
}