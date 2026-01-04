import { ReportRepository } from "../domain/interfaces/ReportRepository";
import { ProjectRepository } from "../domain/interfaces/ProjectRepository";
import { AgentFactory } from "../AI_Strategies/factory/AgentFactory";
import { Report } from "../domain/reports/report.types";
import { v4 as uuidv4 } from 'uuid';

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
            modelName: string;     // 'GPT'
            modeName: string;      // 'IMAGE_AND_TEXT'
            selectedImageIds: string[];
            templateId: string;
        }
    ): Promise<Report> {
        
        console.log(`⚙️ Service: Starting generation for Project ${projectId}`);

        // 1. Fetch the Project Data (The Context)
        const project = await this.projectRepo.getById(projectId);
        if (!project) throw new Error("Project not found");

        // 2. Build the Workflow using our Factory INSTANCE
        const workflow = this.agentFactory.createWorkflow(
            input.reportType,
            input.modelName,
            input.modeName
        );

        // 3. Run the AI Workflow
        // (This runs: Collect -> RAG -> Agent -> Builder)
        const newReport = await workflow.generateReport(project, {
            selectedImageIds: input.selectedImageIds,
            template: { templateId: input.templateId } // Mock template
        });

        // 4. Save the result to the Database
        await this.reportRepo.save(newReport);

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
        newContent: string
    ): Promise<void> {
        // 1. Fetch Report
        const report = await this.reportRepo.getById(reportId);
        if (!report) throw new Error("Report not found");

        // 2. 👇 SAVE THE SNAPSHOT BEFORE EDITING
        // This saves "Version 1" before we turn it into "Version 2"
        await this.createVersionSnapshot(report);

        // 3. Now it is safe to modify the data
        const section = report.sections.find(s => s.id === sectionId);
        if (!section) throw new Error("Section not found");

        section.content = newContent;
        section.isReviewRequired = false;

        // 4. Save the new version
        await this.reportRepo.update(report);
        
        console.log(`📝 Saved Version ${report.versionNumber - 1} and updated report.`);
    }
    

    /**
     * Helper to save a history snapshot
     */
    private async createVersionSnapshot(report: Report) {
        // Snapshot the current state before changes
        const snapshot = JSON.stringify(report);
        await this.reportRepo.saveVersion(
            report.reportId, 
            report.versionNumber, 
            snapshot
        );
        report.versionNumber++; // Increment current version
    }
}