import { AgentStrategy, ExecutionModeStrategy } from "../strategies/interfaces";
import { GemminiAgent } from "../strategies/LLM/Gemmini";
import { GrokAgent } from "../strategies/LLM/Grok";
import { TextOnlyMode } from "../strategies/Execution/TextOnlyMode";
import { ImageAndTextMode } from "../strategies/Execution/ImageAndTextMode";

import { getGrokClient } from '../../infrastructure/llm/grokClient'; // Import from Infra
import { getOpenAIClient } from '../../infrastructure/llm/openAIClient'; // 🟢 Import OpenAI Client

// import { geminiClient } from '../../infrastructure/llm/geminiClient'; // Import from Infra


import { ReportGenerationWorkflow } from "../ReportWorkflows/ReportGenerationWorkflow"
import { ParallelDispatcher } from "../ReportWorkflows/workflow/ParallelDispatcher";
import { SequentialAuthor } from "../ReportWorkflows/workflow/SequentialAuthor";
import { BlackboardWorkflow } from "../ReportWorkflows/workflow/BlackboardWorkflow";
import { AssemblyWorkflow } from "../ReportWorkflows/workflow/AssemblyWorkflow";
import { BasicWorkflow } from "../ReportWorkflows/workflow/BasicWorkflow";

import { ReportBlueprint } from "../../domain/reports/templates/report_templates";
import { PlannerAgent } from "../ChatSystem/Agents/PlannerAgent";
import { ResearcherAgent } from "../ChatSystem/Agents/ResearcherAgent";
import { DataSerializer } from "../ChatSystem/adapter/serializer";


// The Chat System
import { ChatOrchestrator } from "../ChatSystem/core/ChatOrchestrator";
import { KnowledgeService } from "../../Services/KnowledgeServivce";
import { ChatEditor } from "../ChatSystem/Agents/EditorAgent";
import { ToolAgent } from "../ChatSystem/Agents/ToolAgent";
import { ResponderAgent } from "../ChatSystem/Agents/ResponderAgent";

export class AgentFactory {

  constructor(private knowledgeService: KnowledgeService) { }

  // 1. Create the AI Model Strategy
  public createStrategy(modelName: string): AgentStrategy {
    switch (modelName.toUpperCase()) {
      // case 'GEMMINI':
      //   return new GemminiAgent();
      case 'GROK':
        return new GrokAgent(getGrokClient());
      // case 'GPT-4o':
      //   return new """";
      default:
        // Default to GPT if unknown
        console.warn(`Unknown model '${modelName}', defaulting to Grok.`);
        return new GrokAgent(getGrokClient());
    }
  }

  // 2. Create the Execution Mode (Now Public)
  public createMode(modeName: string): ExecutionModeStrategy {
    switch (modeName.toUpperCase()) {
      case 'TEXT_ONLY':
        return new TextOnlyMode();
      case 'IMAGE_AND_TEXT':
        return new ImageAndTextMode();
      default:
        return new TextOnlyMode();
    }
  }

  // 3. Create Workflow (Now Public)
  public createWorkflow(
    reportWorkflow: string | undefined,
    modelName: string | undefined,
    modeName: string | undefined
  ): ReportGenerationWorkflow<ReportBlueprint> {
    const safeReportWorkflow = reportWorkflow || 'BASIC';
    const safeModelName = modelName || 'GROK';
    const safeModeName = modeName || 'TEXT_ONLY';
    // 1. Create the dependencies first
    const agent: AgentStrategy = this.createStrategy(safeModelName);
    const mode: ExecutionModeStrategy = this.createMode(safeModeName);

    // 2. Inject them into the correct Workflow
    // Note: Workflows expect (llmClient, knowledgeRepo)
    // We are passing the KnowledgeService as the 'knowledgeRepo'
    switch (safeReportWorkflow) {
      case 'DISPATCHER':
        return new ParallelDispatcher(agent, this.knowledgeService);

      case 'AUTHOR':
        return new SequentialAuthor(agent, this.knowledgeService);

      case 'BLACKBOARD':
        return new BlackboardWorkflow(agent, this.knowledgeService);

      case 'ASSEMBLY':
        return new AssemblyWorkflow(agent, this.knowledgeService);

      case 'BASIC':
        return new BasicWorkflow(agent, this.knowledgeService, mode);

      default:
        throw new Error(`Unknown report type: ${reportWorkflow}`);
    }
  }
  // Create the full Orchestrator
  public createChatAgent(modeName: string): ChatOrchestrator {
    // 1. Create Dependencies
    const agent = this.createStrategy(modeName);
    const editorAgent = new ChatEditor(agent);

    // 🟢 FIX: Pass the raw OpenAI client to Router and ToolAgent
    // The previous implementation used grokClient which caused "model not found" for gpt-4o
    const openAIClient = getOpenAIClient();

    const planner = new PlannerAgent(agent); // Logic to detect "change/rewrite"
    const researcher = new ResearcherAgent(agent);
    const serializer = new DataSerializer();
    const toolAgent = new ToolAgent(openAIClient);
    const responderAgent = new ResponderAgent(agent); // 🟢 NEW: For conversational responses

    // 2. Inject them
    return new ChatOrchestrator(planner, researcher, editorAgent, serializer, toolAgent, responderAgent);
  }

}
