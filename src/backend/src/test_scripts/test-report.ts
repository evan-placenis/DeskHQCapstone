// src/test_scripts/test-report.ts

import { ObservationReportWorkflow } from '../AI_Strategies/ReportWorkflows/Parallel/Dispatcher';
import { grokClient } from '../infrastructure/llm/grokClient'; // Your real AI
import { GrokAgent } from '../AI_Strategies/strategies/LLM/Grok';
import { Project } from '../domain/core/project.types';
import { ReportPayLoad } from '../domain/interfaces/ReportPayLoad';



// ---------------------------------------------------------
// 1. MOCK REPO (Fake Vector DB)
// ---------------------------------------------------------
class MockKnowledgeRepository {
    async findRelevantSpecs(query: string, limit: number): Promise<any[]> {
        console.log(`🔎 [PARALLEL CHECK] Searching DB for: "${query.substring(0, 30)}..."`);
        return [
            { id: "spec_1", text: "Roofing Spec 2.1: Flashings must be sealed." },
            { id: "spec_2", text: "Safety Code 5.0: Keep exits clear." }
        ];
    }
}

// 1. ADD THIS MOCK CLASS BACK TO YOUR FILE
class MockLLMClient {
    async generateContent(system: string, user: string): Promise<string> {
        // Simulate a slight network delay to prove parallel execution works
        await new Promise(resolve => setTimeout(resolve, 1000)); 

        if (system.includes("Report Architect")) {
            return JSON.stringify({
                chapters: [
                    { title: "Roofing", description: "Roof stuff", relevantNoteIds: ["note_1"] },
                    { title: "Safety", description: "Safety stuff", relevantNoteIds: ["note_2"] }
                ]
            });
        }
        // Return dummy section for Writer
        return JSON.stringify({
            title: "Mock Section",
            bodyMd: "This is a mock generated section.",
            images: []
        });
    }
}

// ---------------------------------------------------------
// 2. DUMMY DATA
// ---------------------------------------------------------
const dummyProject: Project = {
    projectId: "proj_123",
    name: "Skyline Tower Renovation",
    organizationId: "org_1",
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
    metadata: {
        createdDate: new Date(),
        createdByUserId: "Test User",
        lastModifiedDate: new Date(),
        status: "ACTIVE"
    },
    jobInfo: {
        rawText: "Test job description",
        parsedData: { note: "Parsed notes." }
    } as any
};

const dummyPayload: ReportPayLoad = {
    projectId: dummyProject.projectId,
    userId: "user_555",
    writingMode: 'AI_DESIGNED', // <--- Triggers the Architect to create chapters
    notes: [
        // We provide DISTINCT notes to force the Architect to create 2 separate chapters
        // If it creates 2 chapters, we can verify parallel execution.
        { id: "note_1", content: "Roof flashing is rusted." },
        { id: "note_2", content: "Fire exit is blocked by debris." }
    ],
    input: {
        reportType: "OBSERVATION",
        modelName: "grok-beta",
        modeName: "fast",
        selectedImageIds: ["img_1", "img_2"],
        templateId: "default-template"
    }
};

// ---------------------------------------------------------
// 3. THE TEST RUNNER
// ---------------------------------------------------------
async function runTest() {
    console.log("🎬 STARTING PARALLEL EXECUTION TEST...");
    const startTime = Date.now();

    // A. Setup
    // Ensure 'grokClient' is configured with your API Key in .env
    const aiClient = new GrokAgent(grokClient); 
    const repo = new MockKnowledgeRepository();
    const workflow = new ObservationReportWorkflow(aiClient, repo);

    try {
        // B. Run
        const report = await workflow.generateReport(dummyProject, dummyPayload);
        
        const duration = (Date.now() - startTime) / 1000;

        // C. Results
        console.log("\n✅ REPORT GENERATION SUCCESS!");
        console.log(`⏱️ Total Time: ${duration.toFixed(2)}s`);
        console.log("------------------------------------------------");
        console.log("Title:", report.title);
        console.log(`Sections Created: ${report.sections.length}`);
        
        // ✅ FIX: Add ': any' or specific types to satisfy the linter
        report.sections.forEach((sec: any, i: number) => {
            console.log(`[Section ${i+1}] Title: ${sec.sectionTitle}`);
        });
        console.log("------------------------------------------------");

    } catch (error) {
        console.error("❌ TEST FAILED:", error);
    }
}

runTest();