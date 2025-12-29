import { ReportGenerationWorkflow } from "./ReportGenerationWorkflow";
import { Project } from "../../domain/core/project.types";
import { Report } from "../../domain/reports/report.types";
import { ReportBuilder } from "../../domain/reports/ReportBuilder";
import { AgentExecutionContext } from "../strategies/interfaces";
import { ReportPayLoad } from "../../domain/interfaces/ReportPayLoad";

import { ARCHITECT_SYSTEM_PROMPT, WRITER_SYSTEM_PROMPT, architectUserPrompt, writerUserPrompt } from '../prompts/reportPrompt';
// We define what the "Middle Step" returns: An array of detailed sections.
type SectionOutput = { 
    title: string; 
    bodyMd: string; 
    images: string[];
    severity?: string;
};

// We define the Plan structure
interface ChapterPlan {
    title: string;
    description: string;
    relevantNoteIds: string[];
}

export class ObservationReportWorkflow extends ReportGenerationWorkflow<SectionOutput[]> {

    constructor(
        private llmClient: any,    // Your AI Client Wrapper
        private knowledgeRepo: any // Your Vector DB Wrapper
    ) {
        super();
    }

    // =========================================================
    // STEP 1: VALIDATION
    // =========================================================
    protected async collectInputs(project: Project, payload: ReportPayLoad): Promise<AgentExecutionContext> {
        console.log("📂 Collecting inputs for OBSERVATION report...");
        
        // Guard Clause: Observations need images
        if (!payload.input.selectedImageIds || payload.input.selectedImageIds.length === 0) {
            throw new Error("Observation Reports require at least one image.");
        }

        return new AgentExecutionContext(
            project,
            payload.input.selectedImageIds,
            [], 
            payload.input.templateId,
            payload // Pass the full payload to access 'writingMode' and 'notes'
        );
    }

    // =========================================================
    // STEP 2: THE INTELLIGENCE (Architect + Writer Loop)
    // =========================================================
    protected async invokeAgent(context: AgentExecutionContext): Promise<SectionOutput[]> {
        
        const payload = context.payload as ReportPayLoad;
        const notes = payload.notes as any[]; // Assuming notes have {id, content}

        // -----------------------------------------------------
        // PHASE A: PLANNING (The Fork)
        // -----------------------------------------------------
        let reportPlan: ChapterPlan[];

        if (payload.writingMode === 'USER_DEFINED') {
            console.log("👤 Using User-Defined Structure...");
            
            // Map the user's drag-and-drop groups directly to our Plan format
            // We SKIP the Architect Agent here because the user *is* the Architect.
            reportPlan = payload.userDefinedGroups!.map(group => ({
                title: group.title,
                description: group.instructions || "Write a detailed observation section based on these notes.",
                relevantNoteIds: group.noteIds
            }));

        } else {
            console.log("🤖 calling Architect Agent to design structure...");
            
            // Call the Architect AI to organize the mess of notes into chapters
            const architectResponse = await this.llmClient.generateContent(
                ARCHITECT_SYSTEM_PROMPT,
                architectUserPrompt(notes),
                context
            );
            
            // Parse AI response (Expected: { chapters: [...] })
            const parsed = this.parseJsonSafely(architectResponse);
            reportPlan = parsed.chapters;
        }

        // -----------------------------------------------------
        // PHASE B: EXECUTION (The Loop) Runs in parallel
        // -----------------------------------------------------
        console.log(`✍️ Writers are drafting ${reportPlan.length} sections in parallel...`);

        const writingTasks = reportPlan.map(async (chapter) => {
            
            // 1. Gather Data: Get the specific text notes for this chapter
            const relevantNotes = notes
                .filter(n => chapter.relevantNoteIds.includes(n.id))
                .map(n => n.content); // Extract just the text string

            // 2. Local RAG: Find Specs relevant to THIS chapter title + notes
            //    (e.g., Search for "Roofing Flashing" specs)
            const searchQuery = `${chapter.title} ${relevantNotes.join(' ').substring(0, 200)}`;
            const relevantSpecs = await this.knowledgeRepo.findRelevantSpecs(searchQuery, 3);
            
            // Format specs for the prompt
            const specTexts = relevantSpecs.map((s: any) => `[Spec ${s.id}]: ${s.text}`);

            // 3. Call Writer Agent
            //    It gets the Plan (Title/Desc), the Notes, and the Specs.
            const sectionJson = await this.llmClient.generateContent(
                WRITER_SYSTEM_PROMPT,
                writerUserPrompt(
                    chapter.title, 
                    chapter.description, 
                    relevantNotes, 
                    specTexts
                ),
                context
            );

            // 4. Return the structured JSON section
            return this.parseJsonSafely(sectionJson);
        });

        // Wait for all writers to finish
        const completedSections = await Promise.all(writingTasks);
        
        return completedSections;
    }

    // =========================================================
    // STEP 3: ASSEMBLY
    // =========================================================
    protected async postProcessOutput(rawSections: SectionOutput[], context: AgentExecutionContext): Promise<Report> {
        console.log("✨ Assembling Final Report Object...");

        const builder = new ReportBuilder(context.project.projectId, context.payload.userId);

        // 1. Set Basic Info
        builder
            .setTitle(`Observation Report - ${context.project.name}`)
            .setStatus("DRAFT")
            .setTemplate(context.templateId);

        // 2. Loop through the AI Sections and add them to the Report
        rawSections.forEach(section => {
            builder.addSection(
                section.title, 
                section.bodyMd, 
                section.images || [] // Attach image IDs if the writer identified them
            );
        });

        return builder.build();
    }

    // --- Helpers ---
    private parseJsonSafely(text: string): any {
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(clean);
        } catch (e) {
            console.error("Failed to parse JSON", text);
            throw new Error("AI Output was not valid JSON");
        }
    }
}

// 🧠 Why did we do this?
// Consistency: You can never create a report without RAG 
// (retrieveContextWithRAG), because it is hard-coded into the parent's generateReport flow.

// Safety: If you try to create an ObservationReport without images, 
// the collectInputs step throws an error before you waste money calling the AI API.



// If you ever need to change how a Report is created (e.g., automatically adding
// a "Disclaimer" section to every report), you only have to update the ReportBuilder
//  class, and every workflow in your system automatically gets the update.