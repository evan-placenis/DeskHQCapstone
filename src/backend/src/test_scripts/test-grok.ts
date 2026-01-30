import { grokClient } from '../infrastructure/llm/grokClient'; // The "Phone Line"
import { GrokAgent } from '../AI_Strategies/strategies/LLM/Grok'; // The "Conversation" Logic
import { AgentExecutionContext } from '../AI_Skills/llm/interfaces'
import { Project } from '../domain/core/project.types';
import { v4 as uuidv4 } from 'uuid';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

async function testGrokStrategy() {
    console.log("🤖 Testing Grok Strategy (Infrastructure + Logic)...\n");

    try {
        // 1. Initialize the Strategy (Just like the Container does)
        const strategy = new GrokAgent(grokClient);

        // 2. Create a Fake Project (Required by the Class Constructor)
        const mockProject: Project = {
            projectId: "proj-skylark-7",
            organizationId: "org-001",
            name: "Project Skylark-7",
            status: "ACTIVE",
            metadata: {
                createdDate: new Date(),
                lastModifiedDate: new Date(),
                createdByUserId: "user-007",
                status: "active"
            },
            jobInfo: {
                clientName: "Wayne Enterprises",
                siteAddress: "Gotham City",
                parsedData: {}
            },
            images: [],
            knowledgeItems: []
        };

        // 3. Instantiate the Context Class
        const mockContext = new AgentExecutionContext(
            mockProject,                    // project
            [],                             // selectedImages
            ["User prefers concise summary"], // retrievedContext
            "Standard Report Template"      // template
        );

        // 3. Define rest of the inputs
        const systemPrompt = "You are a witty tech assistant who loves puns.";
        const userMessage = "Explain why Clean Architecture is useful in one sentence.";

        console.log(`Sending Prompt: "${userMessage}"`);
        console.log(`System Persona: "${systemPrompt}"`);
        console.log("---------------------------------------------------");

        // 3. Execute
        const response = await strategy.generateContent(systemPrompt, userMessage, mockContext);

        // 4. Output
        console.log(`\n${GREEN}✔ SUCCESS! Grok Strategy replied:${RESET}`);
        console.log("---------------------------------------------------");
        console.log(response);
        console.log("---------------------------------------------------");

    } catch (error: any) {
        console.error(`\n${RED}❌ FAILED:${RESET}`, error.message);
        if (error.status === 401) {
            console.log("💡 Tip: Check XAI_API_KEY in your .env file.");
        }
    }
}

testGrokStrategy();