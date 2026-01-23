import { ReportGenerationWorkflow } from "../ReportGenerationWorkflow";
import { Project } from "../../../domain/core/project.types";
import { Report } from "../../../domain/reports/report.types";
import { ReportBuilder } from "../../../domain/reports/ReportBuilder";
import { AgentExecutionContext } from "../../strategies/interfaces";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad";

// Templates & Blueprints
import {
    ObservationReportTemplate,
    ReportBlueprint,
    SectionBlueprint
} from "../../../domain/reports/templates/report_templates";

// Prompts
import {
    WRITER_SYSTEM_PROMPT,
    writerUserPrompt,
    REVIEWER_SYSTEM_PROMPT,
    reviewerUserPrompt
} from '../../prompts/report/reportDispatcherPrompt';


export class BlackboardWorkflow extends ReportGenerationWorkflow<ReportBlueprint> {

    constructor(
        private llmClient: any,    // Your AI Client Wrapper
        private knowledgeService: any // Your Vector DB Wrapper
    ) {
        super();
    }

    // =========================================================
    // STEP 1: VALIDATION
    // =========================================================
    protected async collectInputs(project: Project, payload: ReportPayLoad): Promise<AgentExecutionContext> {
        console.log("📂 Collecting inputs for OBSERVATION report...");

        // Guard Clause: Observations need images
        if (!payload.selectedImageIds || payload.selectedImageIds.length === 0) {
            throw new Error("Observation Reports require at least one image.");
        }

        return new AgentExecutionContext(
            project,
            payload.selectedImageIds,
            [], // TODO: Add relevant specs
            payload.templateId,
            payload // Pass the full payload to access 'writingMode' and 'notes'
        );
    }

    protected async retrieveContextWithRAG(context: AgentExecutionContext): Promise<void> {
        // Resolve IDs to Images
        const images = context.project.images?.filter(img => context.selectedImages.includes(img.imageId)) || [];

        // Extract descriptions/tags
        // Fallback to "Image" if no description/tag is found
        const descriptions = images.map(img => img.description || img.metadata?.tags?.join(" ") || "Image");

        // send the photo description to pinecone and get the relevant specs
        const relevantSpecs = await this.knowledgeService.search(descriptions, context.project.projectId);

        // Store in context for the agent to use
        context.retrievedContext = relevantSpecs;
    }

    // =========================================================
    // STEP 2: THE INTELLIGENCE (Writer Loop -> Reviewer)
    // =========================================================
    protected async invokeAgent(context: AgentExecutionContext): Promise<ReportBlueprint> {

        const payload = context.payload as ReportPayLoad;
        const rawPhotoNotes = payload.notes as any[]; // Assuming notes have {id, content}

        // 1. THE DISPATCHER (Sorts the chaos) -> TODO: Implement this once we want AI createing a report.
        // We assume 'organizeNotesBySection' is a helper that uses embeddings or a cheap LLM
        // const categorizedData = await this.organizeNotesBySection(allNotes, blueprint.reportContent);
        /**
         * categorizedData = {
         * "2.0 Site Conditions": [Note_A, Note_B, Image_1],
         * "3.0 Observations": [Note_C, Image_2]
         * }
         */

        // -----------------------------------------------------
        // PHASE A: TEMPLATE SELECTION (The "Map")
        // -----------------------------------------------------
        let blueprint: ReportBlueprint;

        if (payload.writingMode === 'USER_DEFINED') {
            // Convert User Groups -> SectionBlueprints
            blueprint = {
                _review_reasoning: "",
                reportTitle: `Observation Report - ${context.project.name}`,
                reportContent: payload.userDefinedGroups!.map((g, i) => ({
                    _reasoning: "",
                    title: g.title,
                    description: g.instructions || "Analyze the provided notes.",
                    required: true,
                    images: [],
                    order: i + 1,
                    isReviewRequired: true,
                    children: []
                }))
            };

        } else {
            console.log("📄 Loading Standard Observation Template...");
            // Clone the template to avoid mutating the global constant
            blueprint = JSON.parse(JSON.stringify(ObservationReportTemplate[0]));
        }


        // -----------------------------------------------------
        // PHASE B: EXECUTION (The Loop) Runs in parallel
        // -----------------------------------------------------
        console.log(`✍️ Spawning ${blueprint.reportContent.length} Writers in parallel...`);
        //THE WRITERS (One per Section, NOT per Image)
        const writingTasks = blueprint.reportContent.map(async (sectionTemplate) => {

            // 1. Contextual Retrieval (RAG)
            //    Find notes relevant to THIS section (e.g., "Roofing" + "Leaks")
            //    This is cheaper/smarter than passing ALL notes to EVERY writer.
            // const query = `${sectionTemplate.title} ${sectionTemplate.description}`;

            // Map payload notes to expected format for the prompt
            const formattedNotes = (payload.notes || []).map((n: any) => ({
                text: n.content || JSON.stringify(n),
                imageIds: n.imageId ? [n.imageId] : []
            }));

            // Use global specs retrieved in Step B (stored in context)
            const relevantSpecs = context.retrievedContext || [];

            // 2. Call The Writer
            const response = await this.llmClient.generateContent(
                WRITER_SYSTEM_PROMPT,
                writerUserPrompt(formattedNotes, sectionTemplate, relevantSpecs),
                context
            );

            // 3. Parse & Return the Filled Section
            return this.parseJsonSafely<SectionBlueprint>(response);
        });

        // Wait for all sections to be drafted
        const draftedSections = await Promise.all(writingTasks);

        // Assemble the Draft Report
        const draftReport: ReportBlueprint = {
            ...blueprint,
            reportContent: draftedSections
        };

        // -----------------------------------------------------
        // PHASE C: THE REVIEWER (The "Reduce")
        // -----------------------------------------------------
        console.log("🕵️ Reviewer is polishing the draft...");

        const reviewResponse = await this.llmClient.generateContent(
            REVIEWER_SYSTEM_PROMPT,
            reviewerUserPrompt(draftReport),
            context
        );

        const finalJson = this.parseJsonSafely<ReportBlueprint>(reviewResponse);

        // Return the fully polished JSON structure
        return finalJson;
    }

    // =========================================================
    // STEP 3: SERIALIZATION (JSON -> Domain Entity)
    // =========================================================
    protected async postProcessOutput(
        aiOutput: ReportBlueprint,
        context: AgentExecutionContext
    ): Promise<Report> {
        console.log("✨ Converting AI JSON to Domain Report...");

        const builder = new ReportBuilder(context.project.projectId, context.payload.userId);

        // 1. Header Info
        builder
            .setTitle(aiOutput.reportTitle) // Reviewer might have renamed it
            .setStatus("DRAFT")
            .setTemplate(context.templateId);

        // 2. Body Content
        //    The Reviewer might have reordered/merged sections, so we iterate
        //    the FINAL 'reportContent' array.
        aiOutput.reportContent.forEach(section => {

            // Note: The 'content' field in your Blueprint likely holds the Markdown body.
            // Ensure your Blueprint type has a field for the body text (e.g. 'description' or new 'body').
            // Here we assume 'description' was filled with the content, 
            // OR you should add a 'body' field to SectionBlueprint.

            builder.addSection(
                section.title,
                section.description, // <--- Assumes Writer filled this with the report text
                section.images || []
            );
        });

        return builder.build();
    }

    // --- Helpers ---
    private parseJsonSafely<T>(text: string): T {
        try {
            const clean = text.replace(/```json/g, '').replace(/```/g, '');
            return JSON.parse(clean);
        } catch (e) {
            console.error("Failed to parse JSON", text);
            throw new Error("AI Output was not valid JSON");
        }
    }
}
