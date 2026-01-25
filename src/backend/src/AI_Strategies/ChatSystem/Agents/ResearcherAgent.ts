import { IChatResearcher } from "../interfaces";
import { AgentStrategy } from "../../strategies/interfaces";

// Define a simple interface for what your Knowledge Service returns
interface SearchResult {
    matches: Array<{
        score: number;
        metadata: { text: string; source?: string };
    }>;
}

export class ResearcherAgent implements IChatResearcher { //should also be used for the report generation workflow
    constructor(private agent: AgentStrategy, private knowledgeService: any, private exa: any) { }

    /**
     * 🧠 Step 1: Check Internal Memory
     */
    private async searchVectorStore(query: string, projectId: string): Promise<string | null> {
        try {
            const result: SearchResult = await this.knowledgeService.search(query, projectId);
            // Check confidence threshold (e.g., 0.80)
            // If we have a high-confidence match, return it.
            if (result.matches && result.matches.length > 0 && result.matches[0].score > 0.80) {
                console.log("🧠 Found answer in memory!");
                return result.matches[0].metadata.text;
            }
            return null;
        } catch (error) {
            console.error("Vector store search failed:", error);
            return null; // Fail gracefully to web search
        }
    }

    /**
     * 🌍 Step 2: Search the Web
     */
    public async searchWeb(query: string): Promise<{ content: string, sources: string[], sourceUrl?: string }> {
        try {
            console.log("🌎 Searching Exa for:", query);

            const result = await this.exa.searchAndContents(query, {
                type: "neural",
                useAutoprompt: true, // Let Exa optimize the query
                numResults: 2,       // Keep it cheap/fast
                text: true
            });

            // Combine findings into one context block
            const content = result.results.map((r: any) => `SOURCE: ${r.title}\nCONTENT: ${r.text}`).join("\n\n");
            const sources = result.results.map((r: any) => r.url);

            // Return the first URL as the primary source for metadata
            const primaryUrl = result.results.length > 0 ? result.results[0].url : "";

            return { content, sources, sourceUrl: primaryUrl };

        } catch (error) {
            console.error("Exa search failed:", error);
            return { content: "", sources: [] };
        }
    }



    /**
     * 🚀 MAIN: The "Smart Search" Workflow
     */
    public async findAnswer(query: string, projectId: string): Promise<{ content: string, sources: string[] }> {
        let contextData = "";
        let sourceLabel = "Internal Knowledge Base";
        let activeSources: string[] = [];

        // 1. Check Pinecone (Memory)
        const memory = await this.searchVectorStore(query, projectId);
        if (memory) {
            contextData = memory;
            activeSources = ["Internal Knowledge Base"];
        } else {
            // 2. Search Exa (Web) if memory failed
            sourceLabel = "External Web Search";
            const webResult = await this.searchWeb(query);

            if (webResult.content) {
                contextData = webResult.content;

                activeSources = webResult.sources && webResult.sources.length > 0
                    ? webResult.sources
                    : [webResult.sourceUrl || "Web Search"];

                // 3. Save for later (Learning)
                // We fire-and-forget this (don't await) so the user gets the answer faster
                this.knowledgeService.saveWebDataToDatabase(
                    webResult.content,
                    webResult.sourceUrl || "Web Search",
                    projectId
                ).catch((err: any) => console.error("Background save failed:", err));
            }
        }

        // If we still have no data, apologize.
        if (!contextData) {
            return { content: "I searched my internal memory and the web, but I couldn't find relevant information on that topic.", sources: [] };
        }

        // 4. SYNTHESIZE: Send to the Agent (LLM) to write the final response
        // We don't want to just dump raw text at the user; we want a polite answer.
        const systemPrompt = `
            You are a helpful research assistant. 
            Answer the user's question based STRICTLY on the provided Context.
            
            CONTEXT (${sourceLabel}):
            ${contextData}

            If the context doesn't answer the question, say you don't know.
            Cite the source if relevant.
        `;

        // Assuming your 'agent' strategy has a method like execute or generate
        const response = await this.agent.generateContent(
            systemPrompt,
            query,
        );

        return { content: response, sources: activeSources };
    }
}

