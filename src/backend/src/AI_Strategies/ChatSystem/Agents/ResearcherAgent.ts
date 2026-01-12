import { IChatResearcher } from "../interfaces";
import { AgentStrategy } from "../../strategies/interfaces";

export class ResearcherAgent{
    constructor(private agent: AgentStrategy) {}

    public async findAnswer(query: string): Promise<{content: string, sources: string[]}> {
        // Placeholder implementation
        return {"content": "Research functionality is not yet implemented.", "sources": []};
    }
}
