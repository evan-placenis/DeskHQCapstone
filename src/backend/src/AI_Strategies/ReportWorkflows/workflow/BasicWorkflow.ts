import { ReportGenerationWorkflow } from "../ReportGenerationWorkflow";
import { Project } from "../../../domain/core/project.types";
import { Report } from "../../../domain/reports/report.types";
import { ReportBuilder } from "../../../domain/reports/ReportBuilder";
import { AgentExecutionContext, ExecutionModeStrategy, VisionAnalysis } from "../../strategies/interfaces";
import { ReportPayLoad } from "../../../domain/interfaces/ReportPayLoad";
import { Container } from "../../../config/container";

// Templates & Blueprints
import {
    ReportBlueprint
} from "../../../domain/reports/templates/report_templates";

// Markdown Templates (Step 2: Migration to Tiptap)
import {
    ObservationReportMarkdownTemplate,
    MarkdownSectionTemplate
} from "../../../domain/reports/templates/markdown_report_templates";

import { MainSectionBlueprint } from "../../../domain/reports/report.types";
import { v4 as uuidv4 } from 'uuid';

// Prompts
import {
    PHOTO_WRITER_SYSTEM_PROMPT,
    writerUserPrompt,
    REVIEWER_SYSTEM_PROMPT,
    reviewerUserPrompt
} from '../../prompts/report/basicPrompt';

// Markdown prompts (Step 2: Migration to Tiptap)
import {
    MARKDOWN_WRITER_SYSTEM_PROMPT,
    markdownWriterUserPrompt,
    MARKDOWN_REVIEWER_SYSTEM_PROMPT,
    markdownReviewerUserPrompt
} from '../../prompts/report/markdownPrompt';


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
        // STEP 2 MIGRATION: Use Markdown templates directly
        // -----------------------------------------------------
        let markdownTemplates: MarkdownSectionTemplate[];
        let reportTitle: string;

        if (payload.writingMode === 'USER_DEFINED') {
            // Convert User Groups -> Markdown Templates
            reportTitle = `Observation Report - ${context.project.name}`;
            markdownTemplates = payload.userDefinedGroups!.map((g, i): MarkdownSectionTemplate => ({
                title: g.title,
                description: g.instructions || "Analyze the provided notes.",
                structure: `# ${g.title}\n\n[Write content based on the provided notes and images]`,
                imageGuidance: "Place images inline where they are most relevant to the text."
            }));

        } else {
            console.log("📄 Loading Standard Observation Template (Markdown format)...");
            // Use the new Markdown template directly
            reportTitle = `Observation Report - ${context.project.name}`;
            markdownTemplates = ObservationReportMarkdownTemplate;
        }


        // -----------------------------------------------------
        // PHASE B: EXECUTION (The Loop) Runs in parallel
        // STEP 2 MIGRATION: Generate Markdown instead of JSON
        // CRITICAL: Store Image IDs, NOT URLs (prevents link rot from expired signed URLs)
        // -----------------------------------------------------
        console.log(`✍️ Spawning ${markdownTemplates.length} Writers in parallel (Markdown mode)...`);
        context.emit('status', `Drafting ${markdownTemplates.length} sections in Markdown...`);

        //THE WRITERS (One per Section, NOT per Image) - Now output Markdown
        // NOTE: We do NOT resolve image URLs here - AI will write Image IDs, frontend resolves URLs
        const writingTasks = markdownTemplates.map(async (markdownTemplate, index) => {

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
                    imageIds: imgIds // Pass IDs only - AI will use them directly in Markdown
                };
            });

            // Use global specs retrieved in Step B (stored in context)
            const relevantSpecs = context.retrievedContext || [];

            // 🟢 STREAMING: For the FIRST writer, stream the reasoning
            const onStream = (index === 0)
                ? (chunk: string) => context.emit('reasoning', chunk)
                : undefined;

            // 2. Call The Writer with Markdown prompt (passing the full Markdown template structure)
            const response = await this.llmClient.generateContent(
                MARKDOWN_WRITER_SYSTEM_PROMPT,
                markdownWriterUserPrompt(formattedNotes, markdownTemplate, relevantSpecs),
                context,
                onStream
            );

            // 3. Return the Markdown text (not JSON)
            return {
                title: markdownTemplate.title,
                markdown: this.cleanMarkdown(response)
            };
        });

        // Wait for all sections to be drafted
        const draftedSections = await Promise.all(writingTasks);

        // Assemble the Draft Report as Markdown
        // Note: The AI should already include the section heading (# Title) in its output
        // But we add it here as a safety measure if it's missing
        const draftMarkdown = draftedSections
            .map(section => {
                const markdown = section.markdown.trim();
                // If the markdown doesn't start with a heading, add it
                if (!markdown.startsWith('#')) {
                    return `# ${section.title}\n\n${markdown}`;
                }
                return markdown;
            })
            .join('\n\n');

        // -----------------------------------------------------
        // PHASE C: THE REVIEWER (The "Reduce") - Now reviews Markdown
        // -----------------------------------------------------
        console.log("🕵️ Reviewer is polishing the Markdown draft...");
        context.emit('status', 'Reviewing and polishing Markdown draft...');

        // 🟢 STREAMING: Stream the Reviewer's reasoning
        const onReviewStream = (chunk: string) => context.emit('review_reasoning', chunk);

        const reviewResponse = await this.llmClient.generateContent(
            MARKDOWN_REVIEWER_SYSTEM_PROMPT,
            markdownReviewerUserPrompt(draftMarkdown),
            context,
            onReviewStream
        );

        const finalMarkdown = this.cleanMarkdown(reviewResponse);

        // Return the Markdown as a simple object (we'll handle conversion in postProcessOutput)
        return {
            reportTitle: reportTitle || "Observation Report",
            markdown: finalMarkdown
        } as any;
    }

    // =========================================================
    // STEP 3: SERIALIZATION (Markdown -> Domain Entity)
    // STEP 2 MIGRATION: Save Markdown to tiptap_content
    // =========================================================
    protected async postProcessOutput(
        aiOutput: any, // Now receives { reportTitle, markdown } instead of ReportBlueprint
        context: AgentExecutionContext
    ): Promise<Report> {
        console.log("✨ Converting Markdown to Domain Report...");
        context.emit('status', 'Finalizing report...');

        const builder = new ReportBuilder(context.project.projectId, context.payload.userId);

        // 1. Header Info
        const reportTitle = aiOutput.reportTitle || "Observation Report";
        builder
            .setTitle(reportTitle)
            .setStatus("DRAFT")
            .setTemplate(context.templateId);

        // 2. For legacy compatibility, we still need to populate reportContent
        //    We'll create a minimal structure from the Markdown
        //    But the primary content is now in tiptap_content
        const legacySections: MainSectionBlueprint[] = [{
            id: 'main-content',
            title: reportTitle,
            description: '',
            required: true,
            order: 1,
            children: []
        }];

        builder.addMainSection(legacySections[0]);

        // 3. Build the report
        const report = builder.build();

        // 4. STEP 2: Add the Markdown content to tiptap_content
        //    The Markdown is ready to be hydrated by Tiptap
        report.tiptapContent = aiOutput.markdown || '';

        return report;
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

    /**
     * Cleans Markdown output from LLM (removes code blocks, extra whitespace)
     */
    private cleanMarkdown(text: string): string {
        // Remove markdown code blocks if present
        let cleaned = text.replace(/```markdown/g, '').replace(/```/g, '').trim();

        // Remove any JSON-like structures that might have leaked through
        // (safety check for transition period)
        if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
            console.warn('[BasicWorkflow] LLM output looks like JSON, attempting to extract Markdown...');
            // Try to find Markdown content after JSON
            const markdownMatch = cleaned.match(/```[\s\S]*?```|(?:^|\n)([^[{].*)/);
            if (markdownMatch && markdownMatch[1]) {
                cleaned = markdownMatch[1].trim();
            }
        }

        return cleaned;
    }
}
