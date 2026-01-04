import { AgentStrategy, ExecutionModeStrategy } from "../strategies/interfaces";
import { GemminiAgent } from "../strategies/LLM/Gemmini";
import { GrokAgent } from "../strategies/LLM/Grok";
import { TextOnlyMode } from "../strategies/Execution/TextOnlyMode";
import { ImageAndTextMode } from "../strategies/Execution/ImageAndTextMode";

import { grokClient } from '../../infrastructure/llm/grokClient'; // Import from Infra
// import { geminiClient } from '../../infrastructure/llm/geminiClient'; // Import from Infra


import { ReportGenerationWorkflow } from "../ReportWorkflows/ReportGenerationWorkflow"
import { ObservationReportWorkflow } from "../ReportWorkflows/ObservationReportWorkflow";


// The Chat System
import { ChatAgent } from "../ChatSystem/ChatAgent";

export class AgentFactory {
  
  // 1. Create the AI Model Strategy
  public createStrategy(modelName: string): AgentStrategy {
    switch (modelName.toUpperCase()) {
      // case 'GEMMINI':
      //   return new GemminiAgent();
      case 'GROK':
        return new GrokAgent(grokClient);
      default:
        // Default to GPT if unknown
        console.warn(`Unknown model '${modelName}', defaulting to Grok.`);
        return new GrokAgent(grokClient);
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
      reportType: string, 
      modelName: string, 
      modeName: string
  ): ReportGenerationWorkflow {
      
    // 1. Create the dependencies first
    const agent: AgentStrategy = this.createStrategy(modelName);
    const mode: ExecutionModeStrategy = this.createMode(modeName);

    // 2. Inject them into the correct Workflow
    switch (reportType.toUpperCase()) {
        case 'OBSERVATION':
            return new ObservationReportWorkflow(agent, mode);
        
        case 'INSPECTION':
            throw new Error("Inspection Report not implemented yet.");

        default:
            throw new Error(`Unknown report type: ${reportType}`);
    }
  }

}