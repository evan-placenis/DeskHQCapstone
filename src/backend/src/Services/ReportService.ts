import { ReportRepository } from "../domain/interfaces/ReportRepository";
import { ProjectRepository } from "../domain/interfaces/ProjectRepository";
import { AgentFactory } from "../AI_Strategies/factory/AgentFactory";
import { Report } from "../domain/reports/report.types";
import { DataSerializer } from "../AI_Strategies/ChatSystem/adapter/serializer"; // 🟢 Imported DataSerializer
import { StreamEvent } from "../AI_Strategies/strategies/interfaces";

import { SupabaseClient } from "@supabase/supabase-js";
import { v4 as uuidv4 } from 'uuid';
export class ReportService {

    private reportRepo: ReportRepository;
    private projectRepo: ProjectRepository;
    private agentFactory: AgentFactory;

    constructor(reportRepo: ReportRepository, projectRepo: ProjectRepository, agentFactory: AgentFactory) {
        this.reportRepo = reportRepo;
        this.projectRepo = projectRepo;
        this.agentFactory = agentFactory;
    }

    /**
     * 🚀 GENERATE: The "Magic Button" function.
     * Orchestrates: DB Fetch -> AI Workflow -> DB Save
     */
    public async generateNewReport(
        projectId: string,
        input: {
            reportType: string;    // 'OBSERVATION'
            reportWorkflow: string; // 'DISPATCHER', "AUTHOR", "BLACKBOARD", "ASSEMBLY", "BASIC"
            modelName: string;     // 'GPT'
            modeName: string;      // 'IMAGE_AND_TEXT'
            selectedImageIds: string[];
            templateId: string;
            sections?: any[];      // Custom sections from frontend
        },
        client: SupabaseClient,
        onStream?: (event: StreamEvent) => void // 🟢 Added Streaming Callback
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
            userId: (await client.auth.getUser()).data.user?.id,
            onStream: onStream // 🟢 Pass callback to workflow
        });

        // 4. Save the result to the Database
        await this.reportRepo.save(newReport, client);

        console.log(`✅ Service: Report ${newReport.reportId} saved.`);
        return newReport;
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
                section.title = updatedStructure.title; // Optional: Decide if AI can rename sections
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

        // section.isReviewRequired = false; // Property removed from MainSectionBlueprint

        // 4. Save the new version
        await this.reportRepo.update(report, client);

        console.log(`📝 Saved Version ${report.versionNumber - 1} and updated report.`);
    }

    /**
     * 🛡️ Helper: Walks the tree and ensures every node has an ID.
     * Use this when accepting structure from AI/Markdown parsers.
     */
    private assignIdsToStructure(items: any[]): any[] {
        return items.map(item => {
            return {
                ...item,
                // If ID exists (from previous state), keep it. If new, generate it.
                id: item.id || uuidv4(),
                // Recursively handle grandchildren
                children: item.children ? this.assignIdsToStructure(item.children) : []
            };
        });
    }

    /**
     * 🤖 AI READ: Helper for Chatbot to "See" the section
     * Call this BEFORE sending the prompt to the LLM.
     */
    public async getSectionContextForAI( //Not in chat service because ReportService owns the Data (fetching, parsing, serializing).
        reportId: string,
        sectionId: string,
        client: SupabaseClient
    ): Promise<any> {
        const report = await this.reportRepo.getById(reportId, client);
        if (!report) throw new Error("Report not found");

        // Helper function to recursively search for section by ID
        const findSectionById = (sections: any[], targetId: string): any => {
            for (const section of sections) {
                // Check if this section matches
                if (section.id === targetId) {
                    return section;
                }
                // Recursively search children (subsections)
                if (section.children && Array.isArray(section.children)) {
                    const found = findSectionById(section.children, targetId);
                    if (found) return found;
                }
            }
            return null;
        };

        const section = findSectionById(report.reportContent, sectionId);

        if (!section) {
            // Enhanced error message with debugging info
            const availableIds = report.reportContent.map(s => s.id || '(no id)').join(', ');
            console.error(`❌ Section not found. Looking for: ${sectionId}`);
            console.error(`📋 Available section IDs: [${availableIds}]`);
            console.error(`📊 Total sections: ${report.reportContent.length}`);
            throw new Error(`Section not found. Section ID: ${sectionId}. Available IDs: [${availableIds}]`);
        }

        // 🟢 Return the full section object so the Serializer can process it
        return section;
    }


    /**
     * Helper to save a history snapshot
     */
    private async createVersionSnapshot(report: Report, client: SupabaseClient) {
        // Snapshot the current state before changes
        try {
            const snapshot = JSON.stringify(report);
            await this.reportRepo.saveVersion(
                report.reportId,
                report.versionNumber,
                snapshot,
                client
            );
            report.versionNumber++; // Increment current version
        } catch (error) {
            console.error("Error creating version snapshot:", error);
            throw error;
        }

    }
}