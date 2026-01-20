import { ReportGenerationWorkflow } from "../ReportGenerationWorkflow";
import { Project } from "../../../domain/core/project.types";
import { Report } from "../../../domain/reports/report.types";
import { ReportBuilder } from "../../../domain/reports/ReportBuilder";
import { AgentExecutionContext, ExecutionModeStrategy, VisionAnalysis } from "../../strategies/interfaces";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad";
import { Container } from "../../../config/container";

// Templates & Blueprints
import {
    ObservationReportTemplate,
    ReportBlueprint
} from "../../../domain/reports/templates/report_temples";

import { MainSectionBlueprint } from "../../../domain/reports/report.types";
import { v4 as uuidv4 } from 'uuid';

// Prompts
import {
    PHOTO_WRITER_SYSTEM_PROMPT,
    writerUserPrompt,
    REVIEWER_SYSTEM_PROMPT,
    reviewerUserPrompt
} from '../../prompts/report/basicPrompt';


// import { ReportSubSection, ReportBulletPoint } from "../../../domain/reports/report.types";

export class BasicWorkflow extends ReportGenerationWorkflow<ReportBlueprint> {

    constructor(
        private llmClient: any,    // Your AI Client Wrapper
        private knowledgeService: any, // Your Vector DB Wrapper
        private executionMode?: ExecutionModeStrategy // Optional Execution Mode Strategy
    ) {
        super();
    }

    // =========================================================
    // STEP 1: VALIDATION
    // =========================================================
    protected async collectInputs(project: Project, payload: ReportPayLoad & { onStream?: any }): Promise<AgentExecutionContext> {
        console.log("📂 Collecting inputs for OBSERVATION report...");

        // Guard Clause: Observations need images
        if (!payload.selectedImageIds || payload.selectedImageIds.length === 0) {
            throw new Error("Observation Reports require at least one image.");
        }

        // 🟢 Pass the Container.adminClient to the context for signing URLs


        return new AgentExecutionContext(
            project,
            payload.selectedImageIds,
            [], // TODO: Add relevant specs
            payload.templateId,
            payload, // Pass the full payload to access 'writingMode' and 'notes'
            Container.adminClient, // 🟢 Admin Client (Required for Private Buckets)
            payload.onStream // Pass the stream callback
        );
    }

    protected async retrieveContextWithRAG(context: AgentExecutionContext): Promise<void> {
        // 0. EXECUTION MODE: Prepare Input (e.g. Vision Analysis)
        let visionDescriptions: string[] = [];

        if (this.executionMode) {
            console.log("⚙️ Running Execution Mode Strategy...");
            // 🟢 STREAMING UPDATE: Analyzing Images
            context.emit('status', 'Analyzing images...');

            const inputData = await this.executionMode.prepareInput(context);

            // Check if we got vision analysis
            if (inputData && inputData.analysis && Array.isArray(inputData.analysis)) {
                console.log(`👁️ Integrated Vision Analysis into Workflow context (${inputData.analysis.length} images analyzed).`);
                // Store it in the payload so we can use it later
                context.payload.visionAnalysis = inputData.analysis;

                visionDescriptions = inputData.analysis.map((a: any) => a.description);
            }
        }

        // Resolve IDs to Images
        const images = context.project.images?.filter(img => context.selectedImages.includes(img.imageId)) || [];

        // Extract descriptions/tags
        // Fallback to "Image" if no description/tag is found
        const existingDescriptions = images.map(img => img.description || img.metadata?.tags?.join(" ") || "Image");

        // Merge descriptions for RAG search
        // If vision agent ran, we use its output + any existing metadata
        const descriptions = [...visionDescriptions, ...existingDescriptions];

        // send the photo description to pinecone and get the relevant specs
        if (descriptions.length > 0) {
            console.log(`🔍 Searching RAG with ${descriptions.length} descriptions...`);
            context.emit('status', 'Searching project knowledge...');
            const relevantSpecs = await this.knowledgeService.search(descriptions, context.project.projectId);

            // Store in context for the agent to use
            context.retrievedContext = relevantSpecs;
        }
    }

    // =========================================================
    // STEP 2: THE INTELLIGENCE (Writer Loop -> Reviewer)
    // =========================================================
    protected async invokeAgent(context: AgentExecutionContext): Promise<ReportBlueprint> {

        const payload = context.payload as ReportPayLoad;

        // --- DEBUG & INPUT PREP ---
        console.log("--- [BASIC WORKFLOW DEBUG] ---");
        console.log("Selected Image IDs:", context.selectedImages);
        console.log("Retrieved Specs:", context.retrievedContext);

        // If no notes are provided but we have images, create "Visual Observation" notes
        // This ensures the AI has something to write about based on the photos
        let processedNotes = payload.notes || [];

        // Retrieve Vision Analysis if available
        const visionAnalysis = context.payload.visionAnalysis as VisionAnalysis[] | undefined;

        if (processedNotes.length === 0 && context.selectedImages && context.selectedImages.length > 0) {
            console.log("⚠️ No user notes found. Generating notes from selected images...");

            if (visionAnalysis && visionAnalysis.length > 0) {
                console.log("✅ Using Vision Agent analysis for notes.");
                processedNotes = visionAnalysis.map(a => ({
                    content: `Visual Observation (AI Analysis): ${a.description}`,
                    imageId: a.imageId
                }));
            } else {
                console.log("Using existing image metadata for notes.");
                processedNotes = context.selectedImages.map(id => {
                    // Resolve image description
                    const img = context.project.images?.find(i => i.imageId === id);
                    const desc = img?.description || img?.metadata?.tags?.join(", ") || "Project Site Photo";
                    return {
                        content: `Visual Observation: ${desc}`,
                        imageId: id
                    };
                });
            }
        }
        console.log("Final Notes passed to Writer:", processedNotes);
        console.log("------------------------------");

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
                isReviewRequired: true,
                reportContent: payload.userDefinedGroups!.map((g, i) => ({
                    id: uuidv4(), // 🟢 Ensure every section has an ID
                    _reasoning: "",
                    title: g.title,
                    description: g.instructions || "Analyze the provided notes.",
                    required: true,
                    order: i + 1,
                    children: []
                }))
            };

        } else {
            console.log("📄 Loading Standard Observation Template...");
            // Clone the template to avoid mutating the global constant
            blueprint = JSON.parse(JSON.stringify(ObservationReportTemplate[0]));

            // 🟢 Ensure all sections have IDs
            blueprint.reportContent = blueprint.reportContent.map(section => ({
                ...section,
                id: section.id || uuidv4()
            }));
        }


        // -----------------------------------------------------
        // PHASE B: EXECUTION (The Loop) Runs in parallel
        // -----------------------------------------------------
        console.log(`✍️ Spawning ${blueprint.reportContent.length} Writers in parallel...`);
        context.emit('status', `Drafting ${blueprint.reportContent.length} sections...`);

        //THE WRITERS (One per Section, NOT per Image)
        const writingTasks = blueprint.reportContent.map(async (sectionTemplate, index) => {

            // 1. Contextual Retrieval (RAG)
            //    Find notes relevant to THIS section (e.g., "Roofing" + "Leaks")
            //    This is cheaper/smarter than passing ALL notes to EVERY writer.
            // const query = `${sectionTemplate.title} ${sectionTemplate.description}`;

            // Map processed notes to expected format for the prompt
            const formattedNotes = processedNotes.map((n: any) => {
                const imgIds = n.imageId ? [n.imageId] : (n.imageIds || []);

                // Find AI description if available for this image
                let aiDesc = "No visual analysis available.";
                if (imgIds.length > 0) {
                    const descriptions = imgIds.map((id: string) => {
                        const analysis = (context.payload.visionAnalysis as VisionAnalysis[])?.find(a => a.imageId === id);
                        return analysis ? analysis.description : null;
                    }).filter((d: string | null) => d !== null);

                    if (descriptions.length > 0) {
                        aiDesc = descriptions.join("\n");
                    }
                }

                return {
                    userNote: n.content || JSON.stringify(n),
                    aiDescription: aiDesc,
                    imageIds: imgIds
                };
            });

            // Use global specs retrieved in Step B (stored in context)
            const relevantSpecs = context.retrievedContext || [];

            // 🟢 STREAMING: For the FIRST writer, stream the reasoning
            const onStream = (index === 0)
                ? (chunk: string) => context.emit('reasoning', chunk)
                : undefined;

            // 2. Call The Writer
            const response = await this.llmClient.generateContent(
                PHOTO_WRITER_SYSTEM_PROMPT,
                writerUserPrompt(formattedNotes, sectionTemplate, relevantSpecs),
                context,
                onStream
            );

            // 3. Parse & Return the Filled Section
            return this.parseJsonSafely<MainSectionBlueprint>(response);
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
        context.emit('status', 'Reviewing and polishing draft...');

        // 🟢 STREAMING: Stream the Reviewer's reasoning
        const onReviewStream = (chunk: string) => context.emit('review_reasoning', chunk);

        const reviewResponse = await this.llmClient.generateContent(
            REVIEWER_SYSTEM_PROMPT,
            reviewerUserPrompt(draftReport),
            context,
            onReviewStream
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
        context.emit('status', 'Finalizing report...');

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
            // 🟢 Pass the structured section directly to the builder
            // The domain now supports the nested structure natively.
            builder.addMainSection(section);
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
