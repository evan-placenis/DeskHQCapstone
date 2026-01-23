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
} from '../../prompts/report/reportSequentialPrompt';


export class SequentialAuthor extends ReportGenerationWorkflow<ReportBlueprint> {

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

        console.log("🔍 [RAG DEBUG] Resolved Image Descriptions in backend:", descriptions);

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
        const allNotes = payload.notes as any[]; // We pass ALL notes every time.

        // 1. Get the Master Template (The "Skeleton")
        let blueprint = JSON.parse(JSON.stringify(ObservationReportTemplate[0]));

        // 2. THE SEQUENTIAL LOOP
        // We act like a single author writing chapter by chapter.
        // We build the report incrementally.
        console.log("✍️ Starting Sequential Authoring...");

        console.log("==========================================");
        console.log("🔍 [GENERATION DEBUG] Context Info");
        console.log("==========================================");
        console.log(`🧠 RAG Specs Available:`, context.retrievedContext ? context.retrievedContext.length : 0);
        if (context.retrievedContext && context.retrievedContext.length > 0) {
            console.log(JSON.stringify(context.retrievedContext, null, 2));
        }
        console.log(`📝 Total Notes:`, allNotes.length);
        console.log("==========================================");

        for (let i = 0; i < blueprint.reportContent.length; i++) {
            const currentSection = blueprint.reportContent[i];

            console.log(`... Writing Section ${i + 1}: ${currentSection.title}`);

            // A. Context Management
            // We pass ALL notes so the agent can decide what is relevant.
            // (Modern LLMs can easily handle 50-100 notes in context)

            // B. The Prompt
            // We ask the agent to fill JUST this section, but we give it 
            // the context of what it has already written (optional, but good for flow).
            const response = await this.llmClient.generateContent(
                WRITER_SYSTEM_PROMPT,
                writerUserPrompt(
                    allNotes,           // Full Context
                    currentSection,     // The Target to fill
                    blueprint,           // (Optional) Pass the whole report so far for continuity
                    context.retrievedContext // Pass RAG specs
                ),
                context
            );

            // C. Update the Blueprint with the result
            const filledSection = this.parseJsonSafely<SectionBlueprint>(response);
            blueprint.reportContent[i] = filledSection;
        }

        // 3. (Optional) Single Review Pass
        // Since the sequential author is coherent, the reviewer only needs to check for typos/safety.
        return blueprint;
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

// 🧠 Why did we do this?
// Consistency: You can never create a report without RAG
// (retrieveContextWithRAG), because it is hard-coded into the parent's generateReport flow.

// Safety: If you try to create an ObservationReport without images,
// the collectInputs step throws an error before you waste money calling the AI API.



// If you ever need to change how a Report is created (e.g., automatically adding
// a "Disclaimer" section to every report), you only have to update the ReportBuilder
//  class, and every workflow in your system automatically gets the update.

