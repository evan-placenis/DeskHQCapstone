import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Container } from '@/lib/container';
import { getWorkflow } from '@/features/ai/services/report-generation/workflow';
import { logger } from '@/lib/logger';
import { CustomLangChainAdapter } from '@/features/ai/services/report-generation/utils/custom-adapter';

import { SupabaseClient } from "@supabase/supabase-js";
import type { ReportGraphProvider } from "@/lib/ai-providers";
// import { imageGeneration } from "@langchain/openai/dist/tools/imageGeneration.cjs";
interface GenerateParams {
  messages: any[];
  systemPrompt: string,       
  structureInstructions: string,
  projectId: string;
  userId: string;
  reportType?: string;
  provider?: ReportGraphProvider;
  draftReportId: string, 
  selectedImageIds?: string[];
  workflowType?: string;
  client: SupabaseClient; // Pass the client explicitly
}

export const maxDuration = 600; // Allow long running agents

/**
 * Wraps the LangGraph stream to log key events to the server console.
 * Useful for debugging logic flows, tool calls, and state updates.
 */
async function* wrapStreamForLogging(stream: AsyncGenerator<any>) {
  for await (const event of stream) {
    // 🔍 FILTER: Log only high-level events (Ignore individual token chunks)
    
    // 1. NODE START (e.g., "Entering Builder...")
    if (event.event === "on_chain_start" && event.name && event.name !== "LangGraph") {
      logger.info(`\n🟢 [NODE START]: ${event.name}`);
      // console.log("   Input:", JSON.stringify(event.data.input).slice(0, 100) + "..."); 
    }

    // 2. NODE END (e.g., "Builder Finished")
    else if (event.event === "on_chain_end" && event.name && event.name !== "LangGraph") {
      logger.info(`🔴 [NODE END]: ${event.name}`);
      // console.log("   Output:", JSON.stringify(event.data.output).slice(0, 100) + "...");
    }

    // 3. TOOL CALL (e.g., "Calling writeSection...")
    else if (event.event === "on_tool_start") {
      logger.info(`🔧 [TOOL CALL]: ${event.name}`);
      logger.info(`   Args:`, JSON.stringify(event.data.input));
    }

    // 4. TOOL RESULT (e.g., "Saved successfully")
    else if (event.event === "on_tool_end") {
      logger.info(`✅ [TOOL RESULT]: ${event.name}`);
      logger.info(`   Result:`, typeof event.data.output === 'string' 
        ? event.data.output.slice(0, 100) 
        : JSON.stringify(event.data.output).slice(0, 100));
    }

    // 5. CUSTOM EVENTS (If you emit any)
    else if (event.event === "on_custom_event") {
      logger.info(`📢 [EVENT]: ${event.name}`, event.data);
    }

    // 🚀 PASS-THROUGH: Yield the event so the Frontend still gets it!
    yield event;
  }
}

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
      provider: provider || "gemini",
      selectedImageIds: selectedImageIds || [],
      imageList: [],
      currentSection: "init",
    };

    // 3. Select graph (default observation — only workflow registered)
    const workflowGraph = getWorkflow(workflowType ?? "observation");
    if (!workflowGraph) {
      return new Response(
        JSON.stringify({
          error: `Workflow type '${workflowType ?? "observation"}' is not available.`,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Start Streaming (Logic decoupled from Response format)
    // Use .streamEvents() for granular token updates if your UI expects typing
    const stream = await workflowGraph.streamEvents(inputState, {
      version: "v2",
    });

    // 🛡️ WRAP IT: Add the logger here!
    const loggedStream = wrapStreamForLogging(stream);

    // 5.Adapt & Return
    // We return the raw Response here so the Route just passes it through
    return CustomLangChainAdapter.toDataStreamResponse(loggedStream);
  }
}