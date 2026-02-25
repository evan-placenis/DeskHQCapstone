
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Container } from '../../config/container'; // Your generic Supabase server client
import { getWorkflow } from '../LangGraph/workflow'; // Dynamic workflow selector
import { CustomLangChainAdapter } from '../LangGraph/utils/custom-adapter';

import { SupabaseClient } from "@supabase/supabase-js";
import { imageGeneration } from "@langchain/openai/dist/tools/imageGeneration.cjs";
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

/**
 * Wraps the LangGraph stream to log key events to the server console.
 * Useful for debugging logic flows, tool calls, and state updates.
 */
async function* wrapStreamForLogging(stream: AsyncGenerator<any>) {
  for await (const event of stream) {
    // 🔍 FILTER: Log only high-level events (Ignore individual token chunks)
    
    // 1. NODE START (e.g., "Entering Builder...")
    if (event.event === "on_chain_start" && event.name && event.name !== "LangGraph") {
      console.log(`\n🟢 [NODE START]: ${event.name}`);
      // console.log("   Input:", JSON.stringify(event.data.input).slice(0, 100) + "..."); 
    }

    // 2. NODE END (e.g., "Builder Finished")
    else if (event.event === "on_chain_end" && event.name && event.name !== "LangGraph") {
      console.log(`🔴 [NODE END]: ${event.name}`);
      // console.log("   Output:", JSON.stringify(event.data.output).slice(0, 100) + "...");
    }

    // 3. TOOL CALL (e.g., "Calling writeSection...")
    else if (event.event === "on_tool_start") {
      console.log(`🔧 [TOOL CALL]: ${event.name}`);
      console.log(`   Args:`, JSON.stringify(event.data.input));
    }

    // 4. TOOL RESULT (e.g., "Saved successfully")
    else if (event.event === "on_tool_end") {
      console.log(`✅ [TOOL RESULT]: ${event.name}`);
      console.log(`   Result:`, typeof event.data.output === 'string' 
        ? event.data.output.slice(0, 100) 
        : JSON.stringify(event.data.output).slice(0, 100));
    }

    // 5. CUSTOM EVENTS (If you emit any)
    else if (event.event === "on_custom_event") {
      console.log(`📢 [EVENT]: ${event.name}`, event.data);
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
      provider: provider || "gemini-cheap",
      selectedImageIds: selectedImageIds || [],
      imageList: [],
      currentSection: "init",
    };

    // 3. Select Graph from user's choice (fallback to "simple" only when undefined)
    const workflowGraph = getWorkflow(workflowType ?? 'simple');

    // 4. Start Streaming (Logic decoupled from Response format)
    // Use .streamEvents() for granular token updates if your UI expects typing
    const stream = await workflowGraph.streamEvents(inputState, {
      version: "v2",
    });

    // 🛡️ WRAP IT: Add the logger here!
    const loggedStream = wrapStreamForLogging(stream);

    //FOR STREAMING TO FRONTEND:
    // import { StreamData } from 'ai'; // Ensure you have the 'ai' package installed
    // const data = new StreamData(); // 1. Create Data Container

    // // 2. Custom Processor
    // async function* processStream(stream: AsyncGenerator<any>) {
    //     for await (const event of stream) {
    //         // A. Log to Server Console
    //         if (event.event === 'on_chain_start' && event.name !== "LangGraph") {
    //              console.log(`🟢 [Server] Node: ${event.name}`);
                 
    //              // B. Send to Frontend (as JSON data)
    //              // This will appear in the 'data' array on the client useChat hook
    //              data.append({
    //                  type: 'log',
    //                  message: `Entering node: ${event.name}`,
    //                  timestamp: Date.now()
    //              });
    //         }
    //         // ... handle other events ...

    //         yield event;
    //     }
        
    //     // C. Close Data Stream when done
    //     data.close();
    // }

    // // const processedStream = processStream(stream);

    // // 3. Pass 'data' to the Adapter
    // return CustomLangChainAdapter.toDataStreamResponse(processedStream, data);

    // 5. Adapt & Return
    // We return the raw Response here so the Route just passes it through
    return CustomLangChainAdapter.toDataStreamResponse(loggedStream);
  }
}