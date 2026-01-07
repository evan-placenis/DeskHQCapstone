import { ReportRepository } from "../domain/interfaces/ReportRepository";
import { ProjectRepository } from "../domain/interfaces/ProjectRepository";
import { AgentFactory } from "../AI_Strategies/factory/AgentFactory";
import { Report } from "../domain/reports/report.types";
import { ReportSerializer } from "../AI_Strategies/Data_Serializer/serializer";

import { SupabaseClient } from "@supabase/supabase-js";

export class ReportService {
    
    private reportRepo: ReportRepository;
    private projectRepo: ProjectRepository;
    private agentFactory: AgentFactory;

    constructor(reportRepo: ReportRepository, projectRepo: ProjectRepository, agentFactory: AgentFactory) {
        this.reportRepo = reportRepo;
        this.projectRepo = projectRepo;
        this.agentFactory =  agentFactory;
    }

    /**
     * 🚀 GENERATE: The "Magic Button" function.
     * Orchestrates: DB Fetch -> AI Workflow -> DB Save
     */
    public async generateNewReport(
        projectId: string,
        input: {
            reportType: string;    // 'OBSERVATION'
            reportWorkflow:string; // 'DISPATCHER' or 'AUTHOR'
            modelName: string;     // 'GPT'
            modeName: string;      // 'IMAGE_AND_TEXT'
            selectedImageIds: string[];
            templateId: string;
            sections?: any[];      // Custom sections from frontend
        },
        client: SupabaseClient
    ): Promise<Report> {
        
        console.log(`⚙️ Service: Starting generation for Project ${projectId}`);

        // 1. Fetch the Project Data (The Context)
        const project = await this.projectRepo.getById(projectId, client);
        if (!project) throw new Error("Project not found");

        // 2. Build the Workflow using our Factory INSTANCE
        const workflow = this.agentFactory.createWorkflow(
            input.reportWorkflow,
            input.modelName,
            input.modeName
        );

        // 3. Run the AI Workflow
        // (This runs: Collect -> RAG -> Agent -> Builder)
        const newReport = await workflow.generateReport(project, {
            selectedImageIds: input.selectedImageIds,
            templateId: input.templateId,
            userDefinedGroups: input.sections, // Pass custom sections here
            writingMode: input.sections && input.sections.length > 0 ? 'USER_DEFINED' : 'AI_DESIGNED',
            userId: (await client.auth.getUser()).data.user?.id
        });

        // 4. Save the result to the Database
        await this.reportRepo.save(newReport, client);

        console.log(`✅ Service: Report ${newReport.reportId} saved.`);
        return newReport;
    }

    /**
     * ✏️ EDIT: Called by User manually OR by ChatSystem (acceptSuggestion)
     */
    public async updateSectionContent(
        projectId: string, 
        reportId: string, 
        sectionId: string, 
        newContent: string,
        client: SupabaseClient
    ): Promise<void> {
        // 1. Fetch Report
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");

        // 2. 👇 SAVE THE SNAPSHOT BEFORE EDITING
        // This saves "Version 1" before we turn it into "Version 2"
        await this.createVersionSnapshot(report, client);

        // 3. Now it is safe to modify the data
        const section = report.sections.find(s => s.id === sectionId);
        if (!section) throw new Error("Section not found");

        // 🟢 HYBRID MAGIC: Deserialize Markdown -> JSON
        // Instead of just doing "section.content = newContent", we parse it.
        // This checks if the AI swapped an image, changed a list, or just wrote text.
        const updatedFields = ReportSerializer.deserialize(section, newContent);

        // 4. Merge the updates into the section object
        // This updates content, and potentially metadata (like image src)
        Object.assign(section, updatedFields);
        section.isReviewRequired = false;

        // 4. Save the new version
        await this.reportRepo.update(report, client);
        
        console.log(`📝 Saved Version ${report.versionNumber - 1} and updated report.`);
    }

    /**
     * 🤖 AI READ: Helper for Chatbot to "See" the section
     * Call this BEFORE sending the prompt to the LLM.
     */ 
    public async getSectionContextForAI( //Not in chat service because ReportService owns the Data (fetching, parsing, serializing).
        reportId: string, 
        sectionId: string, 
        client: SupabaseClient
    ): Promise<string> {
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");

        const section = report.sections.find(s => s.id === sectionId);
        if (!section) throw new Error("Section not found");

        // 🟢 HYBRID MAGIC: Serialize JSON -> Markdown
        // Turns the complex object into simple text the AI can read & edit
        return ReportSerializer.serialize(section);
    }
    

    /**
     * Helper to save a history snapshot
     */
    private async createVersionSnapshot(report: Report, client: SupabaseClient) {
        // Snapshot the current state before changes
        const snapshot = JSON.stringify(report);
        await this.reportRepo.saveVersion(
            report.reportId, 
            report.versionNumber, 
            snapshot,
            client
        );
        report.versionNumber++; // Increment current version
    }
}