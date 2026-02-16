
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Container } from '../../config/container'; // Your generic Supabase server client
import { getWorkflow } from '../LangGraph/workflow'; // Dynamic workflow selector
import { CustomLangChainAdapter } from '../LangGraph/utils/custom-adapter';

import { SupabaseClient } from "@supabase/supabase-js";
interface GenerateParams {
  messages: any[];
  systemPrompt: string,       
  structureInstructions: string,
  projectId: string;
  userId: string;
  reportType?: string;
  provider?: 'grok' | 'gemini-pro' | 'claude'| 'gemini-cheap';
  draftReportId: string, 
  selectedImageIds?: string[];
  workflowType?: string;
  client: SupabaseClient; // Pass the client explicitly
}

export const maxDuration = 600; // Allow long running agents

export class ReportOrchestrator {
  
  /**
   * Generates a report stream using the LangGraph engine.
   */
  async generateStream(params: GenerateParams) {
    const { 
      messages, systemPrompt, structureInstructions, projectId, userId, reportType, 
      provider, selectedImageIds, workflowType, client 
    } = params;

    // 1. Convert Messages (Logic decoupled from HTTP)
    const langChainMessages = messages.map((m: any) => 
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // 2. Initialize State
    const inputState = {
      messages: langChainMessages,
      systemPrompt: systemPrompt, 
      structureInstructions: structureInstructions,
      projectId,
      userId,
      reportType: reportType || "standard",
      provider: provider || "gemini-cheap",
      selectedImageIds: selectedImageIds || [],
      currentSection: "init",
      client: client, // Pass the client
    };

    // 3. Select Graph from user's choice (fallback to "simple" only when undefined)
    const workflowGraph = getWorkflow(workflowType ?? 'simple');

    // 4. Start Streaming (Logic decoupled from Response format)
    // Use .streamEvents() for granular token updates if your UI expects typing
    const stream = await workflowGraph.streamEvents(inputState, {
      version: "v2",
    });

    // 5. Adapt & Return
    // We return the raw Response here so the Route just passes it through
    return CustomLangChainAdapter.toDataStreamResponse(stream);
  }
}