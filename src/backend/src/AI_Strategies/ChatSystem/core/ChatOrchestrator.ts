import { ChatSession, ChatMessage, EditSuggestion} from "../../../domain/chat/chat.types";
import { IChatEditor, IPlannerAgent, IChatResearcher } from '../interfaces';
import { DataSerializer } from '../adapter/serializer';
import { DiffUtils } from '../diffUtils/DiffUtils';
import { ToolAgent } from "../Agents/ToolAgent";
import { v4 as uuidv4 } from 'uuid';

export class ChatOrchestrator {

    constructor(
        private plannerAgent: IPlannerAgent,
        private researcherAgent: IChatResearcher,
        private editorAgent: IChatEditor,
        private serializer: DataSerializer,
        private toolAgent: ToolAgent
    ) {}

    /**
     * The Brain 🧠
     * Orchestrates the Architect (Planner) -> Researcher -> Writer (Editor) flow.
     */
    public async processUserMessage(
        session: ChatSession, 
        userQuery: string,
        reportContext?: string | any 
    ): Promise<ChatMessage> {
        
        try {
            // 1. PLAN: Ask the Architect/Planner for steps
            // We pass context existence boolean so the planner knows if it can edit or only answer.
            const recentHistory = session.messages.slice(-5);
            const plan = await this.plannerAgent.generatePlan(userQuery, reportContext, recentHistory);
            console.log("📋 Plan Generated:", plan.steps);

            let accumulatedContext = ""; 
            let finalResponseText = "";
            let suggestion: EditSuggestion | undefined = undefined;

            // 2. EXECUTE LOOP: Chain of Thought
            for (const step of plan.steps) {
                
                console.log(`⚙️ Executing Step [${step.intent}]: ${step.instruction}`);

                switch (step.intent) {
                    
                    case "RESEARCH_DATA":
                        // Agent: Researcher
                        const rawFacts = await this.researcherAgent.findAnswer(step.instruction);

                        //Ensure we store a String, not an Object
                        const factsString = typeof rawFacts === 'object' 
                            ? JSON.stringify(rawFacts, null, 2) // Pretty print the object
                            : rawFacts;
                        
                        // Append to context for the Editor to see later
                        accumulatedContext += `\n\n[RESEARCH FINDINGS]: ${factsString}`;
                        
                        // Add a summary to the chat response so the user knows what happened
                        finalResponseText += `I researched: "${step.instruction}" and found relevant data.\n`;
                        break;

                    case "EDIT_TEXT":
                        // Agent: Editor/Writer
                        // Serialize current document state to markdown so the LLM can read it
                        const currentDocMarkdown = this.serializer.toMarkdown(reportContext);
                        
                        // Create "Super Context" (Document + Research Findings)
                        const augmentedContext = `
                            CURRENT DOCUMENT:\n${currentDocMarkdown}\n
                            NEW INFORMATION:\n${accumulatedContext}
                        `;
                        console.log("🔍 EDITING:");
                        console.log("🔍 Augmented Context:", augmentedContext);
                        console.log("🔍 Step Instruction:", step.instruction);
                        
                        // Execute rewrite
                        const newText = await this.editorAgent.rewriteSection(augmentedContext, step.instruction);
                        
                        console.log("🔍 New Text:", newText.content);
                        console.log("🔍 Reasoning:", newText.reasoning);
                        console.log("🔍 Chat Message:", newText.chatMessage);
                        // Generate visual diff for the UI
                        suggestion = this.createSuggestion(currentDocMarkdown, newText.content, reportContext, newText.chatMessage);
                        
                        // 🟢 FIX: Ensure the Chat Bubble says something useful, not just generic text.
                        finalResponseText += `\n${newText.reasoning}`; // Append reasoning to chat
                        break;

                    case "EXECUTE_TOOL":
                        // Agent: Tool
                        //const toolResult = await this.toolAgent.execute(step.instruction);
                        accumulatedContext += `\n\n[TOOL RESULT]: Not implemented yet`;
                        finalResponseText += `\nExecuted tool action: Not implemented yet`;
                        break;
                }
            }

            // Fallback if no specific response text was generated
            if (!finalResponseText) {
                finalResponseText = "I have processed your request.";
            }

            // 3. RETURN: Formatted ChatMessage
            return { 
                id: uuidv4(),
                role: 'assistant', // Assuming MessageRole.Assistant
                content: finalResponseText,
                suggestion: suggestion,
                timestamp: new Date(),
                metadata: {
                    planId: uuidv4(), // Optional: if you track plans
                    stepsExecuted: plan.steps.length
                }
            } as unknown as ChatMessage;

        } catch (error) {
            console.error("❌ Orchestrator Error:", error);
            return {
                id: uuidv4(),
                role: 'assistant',
                content: "I encountered an error while processing your request. Please try again.",
                timestamp: new Date(),
                metadata: { isError: true }
            } as unknown as ChatMessage;
        }
    }

    private createSuggestion(original: string, modified: string, reportContext: any, chatMessage: string): EditSuggestion {
        // 🛡️ SAFETY CHECK: Handle if reportContext is just a string or missing
        const sectionId = (typeof reportContext === 'object' && reportContext?.id) 
            ? reportContext.id 
            : 'general-context'; // Fallback if no specific section ID exists

        // 🟢 Generate structured data from markdown for the frontend
        const structuredData = DataSerializer.markdownToSectionStructure(modified);

        return {
            targetSectionId: sectionId,
            reason: chatMessage,
            originalText: original,
            suggestedText: modified,
            suggestedData: structuredData, // 🟢 Include structured data for frontend state update
            changes: DiffUtils.computeDiff(original, modified),
            stats: DiffUtils.calculateDiffStats(original, modified),
            status: 'PENDING' // pending | accepted | rejected
        };
    }
}