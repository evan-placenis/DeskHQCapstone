import { AgentStrategy, ExecutionModeStrategy } from "../strategies/interfaces";
import { GemminiAgent } from "../strategies/LLM/Gemmini";
import { GrokAgent } from "../strategies/LLM/Grok";
import { TextOnlyMode } from "../strategies/Execution/TextOnlyMode";
import { ImageAndTextMode } from "../strategies/Execution/ImageAndTextMode";

import { getGrokClient } from '../../infrastructure/llm/grokClient'; // Import from Infra

// import { geminiClient } from '../../infrastructure/llm/geminiClient'; // Import from Infra


import { ReportGenerationWorkflow } from "../ReportWorkflows/ReportGenerationWorkflow"
import { ParallelDispatcher } from "../ReportWorkflows/workflow/ParallelDispatcher";
import { SequentialAuthor } from "../ReportWorkflows/workflow/SequentialAuthor";
import { BlackboardWorkflow } from "../ReportWorkflows/workflow/BlackboardWorkflow";
import { AssemblyWorkflow } from "../ReportWorkflows/workflow/AssemblyWorkflow";
import { BasicWorkflow } from "../ReportWorkflows/workflow/BasicWorkflow";

import { ReportBlueprint } from "../../domain/reports/templates/report_temples";


// The Chat System
import { ChatAgent } from "../ChatSystem/ChatAgent";
import { KnowledgeService } from "../../Services/KnowledgeServivce";

export class AgentFactory {
  
  constructor(private knowledgeService: KnowledgeService) {}

  // 1. Create the AI Model Strategy
  public createStrategy(modelName: string): AgentStrategy {
    switch (modelName.toUpperCase()) {
      // case 'GEMMINI':
      //   return new GemminiAgent();
      case 'GROK':
        return new GrokAgent(getGrokClient());
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

}
