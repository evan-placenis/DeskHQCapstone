import { ReportRepository } from "../domain/interfaces/ReportRepository";
import { ProjectRepository } from "../domain/interfaces/ProjectRepository";
import { ReportOrchestrator } from "../AI_Skills/orchestrators/ReportOrchestrator";
import { Report } from "../domain/reports/report.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';

/**
 * 🆕 NEW ReportService using AI-SDK with Skills
 * 
 * This version uses the AI-SDK ReportOrchestrator which leverages:
 * - streamText from 'ai' package
 * - Skills-based tools (reportSkills, visionSkills, researchSkills)
 * - ModelStrategy for provider selection
 * 
 * Key differences from old version:
 * - Uses AI-SDK streamText instead of custom workflow classes
 * - Returns streaming result instead of completed Report
 * - Integrates with skills for report generation
 */
export class ReportService {

    private reportRepo: ReportRepository;
    private projectRepo: ProjectRepository;
    private reportOrchestrator: ReportOrchestrator;

    constructor(
        reportRepo: ReportRepository,
        projectRepo: ProjectRepository,
        reportOrchestrator: ReportOrchestrator
    ) {
        this.reportRepo = reportRepo;
        this.projectRepo = projectRepo;
        this.reportOrchestrator = reportOrchestrator;
    }

    /**
     * 🚀 GENERATE: The "Magic Button" function using AI-SDK
     * 
     * This method:
     * 1. Fetches project data
     * 2. Builds initial messages for report generation
     * 3. Calls AI-SDK orchestrator with report skills
     * 4. Returns streaming result (caller handles saving)
     * 
     * Note: The caller (route handler) should:
     * - Stream the response to the frontend
     * - Collect the final report structure
     * - Save it using saveReport method
     */
    public async generateReportStream(
        projectId: string,
        input: any, // normalized input
        client: SupabaseClient,
        userId: string
    ) {
        console.log(`⚙️ Service: Starting AI-SDK generation for Project ${projectId}`);

        // 1. Fetch Template from DB (No more hardcoded strings!)
        const template = await this.reportRepo.getTemplateById(input.reportType, client);
        if (!template) throw new Error(`Template ${input.reportType} not found.`);

        // 2. Create the "Parent" Report Header (The Draft)
        const draftReport = await this.createDraftReport(
            projectId,
            userId,
            input.reportType,
            input.templateId || '',
            client,
            input.title
        );

       // 1. Prepare the Dynamic Context from DB
        const dbContext = `
        ${template.system_prompt}

        REPORT STRUCTURE RULES:
        ${template.structure_instructions}

        Project ID: ${projectId}
        Draft Report ID: ${draftReport.reportId}
        `;

        // 2. Prepare the User Goal
        const userMessage = {
        role: 'user' as const,
        content: template.user_prompt
        };


        // Normalize input - ensure arrays are defined
        const normalizedInput = {
            ...input,
            selectedImageIds: input.selectedImageIds || [],
            sections: input.sections || [],
            templateId: input.templateId || ''
        };
        // Filter out any messages with empty/undefined content
        // 3. Call AI-SDK Orchestrator
        const provider = (normalizedInput.modelName?.toLowerCase())|| 'gemini-cheap';

        const streamResult = await this.reportOrchestrator.generateStream({
            messages: [userMessage], // Only User message here
            context: dbContext,      // Pass DB prompt as a separate param
            projectId,
            userId,
            reportType: normalizedInput.reportType,
            provider,
            draftReportId: draftReport.reportId, // Pass draft report ID to orchestrator
            selectedImageIds: normalizedInput.selectedImageIds,
            client
        });

        // Return the stream result AND draft report ID - the route handler will process it
        return { streamResult, draftReportId: draftReport.reportId };
    }

    /**
      * saveReport (Finalize)
      * Call this when the AI 'submit_report' tool is triggered or the user clicks "Save".
      */
    public async saveReport(reportId: string, client: SupabaseClient): Promise<Report> {
        console.log(`🏁 Finalizing Report: ${reportId}`);

        // 1. Fetch all the "Chunks" (Markdown rows) we've been saving
        const sections = await this.reportRepo.getSectionsByReportId(reportId, client);

        if (!sections || sections.length === 0) {
            throw new Error("Cannot save report: No sections found.");
        }

        // 2. Stitch the chunks into the final Markdown for Tiptap
        const finalMarkdown = this.compileMarkdown(sections);

        // 3. Update the main 'reports' header table
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report header not found");

        report.tiptapContent = finalMarkdown;
        report.updatedAt = new Date();
        report.versionNumber++;

        // 4. Save the finalized header back to the DB
        await this.reportRepo.update(report, client);

        // // 5. Create a version snapshot for history
        // await this.createVersionSnapshot(report, client);

        console.log(`✅ Report ${reportId} is now FINAL and searchable.`);
        return report;
    }


    /**
     * Create a draft report early in the generation process (the header)
     * This allows the AI to write sections incrementally and reference them
     */
    public async createDraftReport(
        projectId: string,
        userId: string,
        reportType: string,
        templateId: string,
        client: SupabaseClient,
        title: string
    ): Promise<Report> {
        const draftReport: Report = {
            reportId: uuidv4(),
            projectId,
            title: (title && title.trim()) ? title.trim() : `${reportType} Report (Draft)`,
            reportContent: [],
            status: 'DRAFT',
            createdAt: new Date(),
            updatedAt: new Date(),
            templateId: templateId || '',
            versionNumber: 1,
            createdBy: userId,
            tiptapContent: undefined,
            isReviewRequired: true
        };

        await this.reportRepo.save(draftReport, client);
        console.log(`📝 Service: Draft report ${draftReport.reportId} created.`);
        return draftReport;
    }

    /**
     * Update a section in an existing report
     * Used by updateSection skill for incremental writing
     */
    public async updateSectionInReport(
        reportId: string,
        sectionId: string,
        heading: string,
        content: string,
        order: number,
        client: SupabaseClient,
        metadata: any = {},
    ): Promise<void> {
        // 1. Delegate DB work to the Infrastructure layer
        await this.reportRepo.upsertSection(
            reportId,
            sectionId,
            {
                heading,
                content: content || "", // Prioritize MD content
                order,
                metadata: metadata // Future-proofing for severity/tags
            },
            client
        );

        // 2. Keep the report header timestamp fresh
        await this.reportRepo.touchReport(reportId, client);

        console.log(`✅ Service: Section [${sectionId}] synced via Repository.`);
    }


    // /**
    //  * The "Stitcher": Compiles chunks into the final Markdown for Tiptap.
    //  */
    // public async finalizeReportMarkdown(reportId: string, client: SupabaseClient): Promise<string> {
    //     // 1. Get structured chunks from Repo
    //     const sections = await this.reportRepo.getSectionsByReportId(reportId, client);

    //     // 2. Stitch them together (The "Hybrid" logic)
    //     const markdown = sections.map((s: any) => {
    //         const heading = `# ${s.heading}\n\n`;
    //         // Clean up those literal \n issues during the stitch
    //         const body = s.content?.replace(/\\n/g, '\n') || "";
    //         return heading + body;
    //     }).join('\n\n---\n\n');

    //     // 3. Update the report header with the final compiled content
    //     const report = await this.reportRepo.getById(reportId, client);
    //     if (report) {
    //         report.tiptapContent = markdown;
    //         await this.reportRepo.update(report, client);
    //     }

    //     return markdown;
    // }

    /**
     * Update report fields (tiptap_content and/or title). Throws if report not found or update fails.
     */
    public async updateReport(
        reportId: string,
        updates: { tiptap_content?: string; title?: string },
        client: SupabaseClient
    ): Promise<void> {
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");
        if (updates.tiptap_content !== undefined) report.tiptapContent = updates.tiptap_content;
        if (updates.title !== undefined) report.title = updates.title;
        report.updatedAt = new Date();
        await this.reportRepo.update(report, client);
    }

    /**
     * 🟢 GET BY ID
     * We now fetch the 'header' from the reports table 
     * and the 'sections' from the new report_sections table.
     */
    public async getReportById(reportId: string, client: SupabaseClient): Promise<Report | null> {
        // 1. Get the main report data from Repository
        const report = await this.reportRepo.getById(reportId, client); //header
        if (!report) return null;

        // 2. Get the structured sections (The "Hybrid" Chunks)
        const sections = await this.reportRepo.getSectionsByReportId(reportId, client); //sections/content

        // 3. Map sections to the domain model
        report.reportContent = sections.map((s: any) => ({
            id: s.section_id,
            title: s.heading,
            description: s.content, // This is your Markdown!
            order: s.order,
            metadata: s.metadata
        }));

        // 4. If we have a Tiptap view already saved, use it. 
        // Otherwise, stitch it on the fly.
        if (!report.tiptapContent) {
            report.tiptapContent = this.compileMarkdown(sections);
        }

        return report;
    }

    /**
     * 🤖 AI CONTEXT HELPER
     * Chatbot can now find a specific section instantly without loading the whole report.
     */
    public async getSectionContextForAI(
        reportId: string,
        sectionId: string,
        client: SupabaseClient
    ): Promise<any> {
        const section = await this.reportRepo.getSection(reportId, sectionId, client);
        if (!section) throw new Error(`Section ${sectionId} not found.`);
        return section;
    }

    /**
     * Accept edit: update a section (by row id) and sync the substring in report.tiptap_content.
     * Reuses updateSectionInReport for the section row; then syncs tiptap_content and returns it.
     */
    public async updateSectionAndTiptapContent(
        reportId: string,
        sectionRowId: string,
        params: { content: string; originalInTiptap?: string; heading?: string },
        client: SupabaseClient
    ): Promise<{ tiptap_content: string } | null> {
        const section = await this.reportRepo.getSectionByRowId(reportId, sectionRowId, client);
        if (!section) throw new Error("Section not found");

        const originalContent =
            typeof params.originalInTiptap === "string" && params.originalInTiptap.trim()
                ? params.originalInTiptap
                : section.content;
        const originalHeading = section.heading;
        const heading = params.heading ?? section.heading;
        const order = typeof section.order === "number" ? section.order : 0;

        await this.updateSectionInReport(
            reportId,
            section.section_id,
            heading,
            params.content,
            order,
            client,
            section.metadata ?? {}
        );

        const report = await this.reportRepo.getById(reportId, client);
        if (!report?.tiptapContent) return null;

        // Normalize line endings so replace matches (ai-edit may return \n-only substring)
        let synced = report.tiptapContent.replace(/\r\n/g, "\n");
        if (originalContent) {
            synced = synced.replace(originalContent, params.content);
        }
        if (params.heading !== undefined && originalHeading && originalHeading !== params.heading) {
            const escaped = originalHeading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const patterns = [
                new RegExp(`^(#{1,6})\\s*${escaped}\\s*$`, "gm"),
                new RegExp(`^${escaped}\\s*$`, "gm"),
            ];
            for (const pattern of patterns) {
                synced = synced.replace(pattern, (match: string, hashes?: string) =>
                    hashes ? `${hashes} ${params.heading}` : (params.heading ?? match)
                );
            }
        }

        report.tiptapContent = synced;
        report.updatedAt = new Date();
        await this.reportRepo.update(report, client);

        return { tiptap_content: synced };
    }

    /**
     * Update section content by template section_id (e.g. "exec-summary").
     * Used by the legacy /api/report/updateSection flow. Syncs tiptap_content when present.
     */
    public async updateSectionContent(
        _projectId: string,
        reportId: string,
        sectionId: string,
        newContent: string,
        client: SupabaseClient
    ): Promise<void> {
        const section = await this.reportRepo.getSection(reportId, sectionId, client);
        if (!section) throw new Error(`Section ${sectionId} not found`);
        await this.reportRepo.updateSectionByRowId(
            reportId,
            section.id,
            { content: newContent },
            client
        );
        const report = await this.reportRepo.getById(reportId, client);
        if (report?.tiptapContent && section.content) {
            const synced = report.tiptapContent.replace(section.content, newContent);
            report.tiptapContent = synced;
            report.updatedAt = new Date();
            await this.reportRepo.update(report, client);
        }
    }



    public async getReportsByProject(projectId: string, client: SupabaseClient): Promise<Report[]> {
        return await this.reportRepo.getByProject(projectId, client);
    }

    /**
     * 🛠️ PRIVATE HELPER: The "Stitcher"
     */
    private compileMarkdown(sections: any[]): string {
        return sections.map(s => {
            let md = "";

            // If you still want the Metadata/Severity badge, keep it here:
            if (s.metadata?.severity) {
                md += `> **Severity:** ${s.metadata.severity.toUpperCase()}\n\n`;
            }

            const body = s.content?.replace(/\\n/g, '\n') || "";
            md += s.heading + "\n\n" + body; //should not be hard coded (probably better to let Ai control)

            return md;
        }).join('\n\n');
    }




    /**
     * Update report plan and status (for Human-in-the-Loop workflows)
     * 
     * This is called by the architectNode when it generates a plan
     * and needs to signal the frontend that approval is required.
     * 
     * @param reportId - The report ID
     * @param updates - Object containing plan and/or status updates
     * @param client - Supabase client
     */
    public async updateReportStatus(
        reportId: string,
        updates: {
            plan?: any;
            status?: string;
        },
        client: SupabaseClient
    ): Promise<void> {
        console.log(`📊 Updating report ${reportId} with status: ${updates.status}`);
        
        const updateData: any = {
            updated_at: new Date().toISOString()
        };

        if (updates.plan) {
            updateData.plan = updates.plan;
        }

        if (updates.status) {
            updateData.status = updates.status;
        }

        const { error } = await client
            .from('reports')
            .update(updateData)
            .eq('id', reportId);

        if (error) {
            console.error('Failed to update report status:', error);
            throw new Error(`Failed to update report status: ${error.message}`);
        }

        console.log(`✅ Report ${reportId} updated successfully`);
    }

    /**
     * Helper to save a history snapshot TODO
     */
    private async createVersionSnapshot(report: Report, client: SupabaseClient) {
        try {
            const snapshot = JSON.stringify(report);
            await this.reportRepo.saveVersion(
                report.reportId,
                report.versionNumber,
                snapshot,
                client
            );
            report.versionNumber++;
        } catch (error) {
            console.error("Error creating version snapshot:", error);
            throw error;
        }
    }
}
