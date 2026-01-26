import { ReportRepository } from "../domain/interfaces/ReportRepository";
import { ProjectRepository } from "../domain/interfaces/ProjectRepository";
import { ReportOrchestrator } from "../AI_Skills/orchestrators/ReportOrchestrator";
import { Report } from "../domain/reports/report.types";
import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
import { DataSerializer } from "../AI_Strategies/ChatSystem/adapter/serializer";

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
export class ReportServiceNew {

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
        input: {
            reportType: string;    // 'OBSERVATION'
            modelName: string;     // 'grok', 'gemini', 'claude'
            selectedImageIds: string[];
            templateId: string;
            sections?: any[];      // Custom sections from frontend
        },
        client: SupabaseClient,
        userId: string
    ) {
        console.log(`⚙️ Service: Starting AI-SDK generation for Project ${projectId}`);

        // 1. Fetch the Project Data (The Context)
        const project = await this.projectRepo.getById(projectId, client);
        if (!project) throw new Error("Project not found");

        // 2. Build initial messages for report generation
        const messages = [
            {
                role: 'system' as const,
                content: `You are an expert technical writer generating a ${input.reportType} report for project: ${project.name || projectId}.
                
            Your task:
            1. Search for project specifications using 'searchInternalKnowledge' or 'searchWeb'
            2. Analyze images using vision tools if provided
            3. Generate report sections using 'updateSection' tool
            4. Follow the template structure provided

            Project Context:
            - Project ID: ${projectId}
            - Project Name: ${project.name || 'N/A'}
            - Selected Images: ${input.selectedImageIds.length} images`
            },
            {
                role: 'user' as const,
                content: `Generate a ${input.reportType} report for this project. 
            ${input.sections && input.sections.length > 0
                        ? `Use these custom sections: ${JSON.stringify(input.sections)}`
                        : 'Design the report structure based on best practices.'}
            ${input.selectedImageIds.length > 0
                        ? `Include analysis of ${input.selectedImageIds.length} selected images.`
                        : ''}`
            }
        ];

        // 3. Call AI-SDK Orchestrator
        const provider = (input.modelName?.toLowerCase() || 'grok') as 'grok' | 'gemini' | 'claude';

        const streamResult = await this.reportOrchestrator.generateStream({
            messages,
            projectId,
            userId,
            reportType: input.reportType,
            provider
        });

        // Return the stream result - the route handler will process it
        return streamResult;
    }

    /**
     * Save a completed report to the database
     * Call this after collecting the final report structure from the stream
     */
    public async saveReport(report: Report, client: SupabaseClient): Promise<Report> {
        await this.reportRepo.save(report, client);
        console.log(`✅ Service: Report ${report.reportId} saved.`);
        return report;
    }

    public async getReportById(reportId: string, client: SupabaseClient): Promise<Report | null> {
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) return null;

        // 🟢 Ensure all sections have IDs (for backward compatibility with old reports)
        let idsAdded = false;
        const ensureSectionIds = (sections: any[]): void => {
            sections.forEach(section => {
                if (!section.id) {
                    section.id = uuidv4();
                    idsAdded = true;
                }
                if (section.children && Array.isArray(section.children)) {
                    ensureSectionIds(section.children);
                }
            });
        };
        ensureSectionIds(report.reportContent);

        // If we added IDs, save the report to persist them
        if (idsAdded) {
            await this.reportRepo.update(report, client);
            console.log(`🆔 Added missing IDs to report ${reportId} and saved`);
        }

        // Hydrate images
        const imageIds = new Set<string>();

        // Helper to collect IDs from nested structure
        const collectIds = (items: any[]) => {
            items.forEach(item => {
                if (item.images && Array.isArray(item.images)) {
                    item.images.forEach((ref: any) => {
                        const id = typeof ref === 'string' ? ref : ref.imageId;
                        if (id) imageIds.add(id);
                    });
                }
                if (item.children && Array.isArray(item.children)) {
                    collectIds(item.children);
                }
            });
        };
        collectIds(report.reportContent);

        if (imageIds.size > 0) {
            // 1. Fetch Referenced Project Images (Base Data for URLs)
            const { data: projectImages, error: piError } = await client
                .from('project_images')
                .select('id, public_url, storage_path, description')
                .in('id', Array.from(imageIds));

            // 2. Fetch Report Images (Metadata/Overrides)
            const { data: reportImages, error: riError } = await client
                .from('report_images')
                .select('image_id, caption, sort_order')
                .eq('report_id', reportId)
                .in('image_id', Array.from(imageIds));

            if (!piError && projectImages) {
                const projectImageMap = new Map(projectImages.map(img => [img.id, img]));
                const reportImageMap = new Map();
                if (reportImages) {
                    reportImages.forEach((row: any) => reportImageMap.set(row.image_id, row));
                }

                // Helper to hydrate images in nested structure
                const hydrateItems = (items: any[]) => {
                    items.forEach(item => {
                        if (item.images && Array.isArray(item.images)) {
                            item.images = item.images.map((ref: any) => {
                                const id = typeof ref === 'string' ? ref : ref.imageId;
                                const pImg = projectImageMap.get(id);
                                const rImg = reportImageMap.get(id);

                                if (pImg) {
                                    return {
                                        imageId: id,
                                        caption: rImg?.caption || (typeof ref === 'object' ? ref.caption : "") || pImg.description,
                                        orderIndex: rImg?.sort_order || (typeof ref === 'object' ? ref.orderIndex : 0),
                                        url: pImg.public_url,
                                        storagePath: pImg.storage_path,
                                        description: pImg.description
                                    };
                                }
                                return ref;
                            });
                        }
                        if (item.children && Array.isArray(item.children)) {
                            hydrateItems(item.children);
                        }
                    });
                };
                hydrateItems(report.reportContent);
            }
        }

        return report;
    }

    public async getReportsByProject(projectId: string, client: SupabaseClient): Promise<Report[]> {
        return await this.reportRepo.getByProject(projectId, client);
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
        // 1. Fetch Report and section
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");
        const section = report.reportContent.find(s => s.id === sectionId);
        if (!section) throw new Error("Section not found");

        // 2. Snapshot (Version N)
        await this.createVersionSnapshot(report, client);

        // 3 Parse Markdown -> JSON
        const updatedStructure = DataSerializer.markdownToSectionStructure(newContent);

        // Update the section fields
        if (updatedStructure) {
            // 1. Update Title if present and changed
            if (updatedStructure.title && updatedStructure.title !== section.title) {
                section.title = updatedStructure.title;
            }

            // 2. Update Description (The main text)
            if (updatedStructure.description !== undefined) {
                section.description = updatedStructure.description;
            }

            // 3. Update Children/Subsections
            if (updatedStructure.children) {
                section.children = this.assignIdsToStructure(updatedStructure.children);
            }
        } else {
            // Fallback if parser fails
            section.description = newContent;
        }

        // 4. Save the new version
        await this.reportRepo.update(report, client);

        console.log(`📝 Saved Version ${report.versionNumber - 1} and updated report.`);
    }

    /**
     * 🛡️ Helper: Walks the tree and ensures every node has an ID.
     */
    private assignIdsToStructure(items: any[]): any[] {
        return items.map(item => {
            return {
                ...item,
                id: item.id || uuidv4(),
                children: item.children ? this.assignIdsToStructure(item.children) : []
            };
        });
    }

    /**
     * 🤖 AI READ: Helper for Chatbot to "See" the section
     */
    public async getSectionContextForAI(
        reportId: string,
        sectionId: string,
        client: SupabaseClient
    ): Promise<any> {
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");

        // Helper function to recursively search for section by ID
        const findSectionById = (sections: any[], targetId: string): any => {
            for (const section of sections) {
                if (section.id === targetId) {
                    return section;
                }
                if (section.children && Array.isArray(section.children)) {
                    const found = findSectionById(section.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const section = findSectionById(report.reportContent, sectionId);

        if (!section) {
            const availableIds = report.reportContent.map(s => s.id || '(no id)').join(', ');
            console.error(`❌ Section not found. Looking for: ${sectionId}`);
            console.error(`📋 Available section IDs: [${availableIds}]`);
            throw new Error(`Section not found. Section ID: ${sectionId}. Available IDs: [${availableIds}]`);
        }

        return section;
    }

    /**
     * Helper to save a history snapshot
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
