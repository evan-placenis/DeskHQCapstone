import { task } from "@trigger.dev/sdk/v3";
import { Container } from '../../../config/container';
import { v4 as uuidv4 } from 'uuid';
import { Report } from '../../../domain/reports/report.types';
import { ChatMessage } from '../../../domain/chat/chat.types';
import type { ChatRepository } from '../../../domain/interfaces/ChatRepository';
import type { ChatService } from '../../../Services/ChatService';
import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// 👇 IMPORT WORKFLOW REGISTRY
import { getWorkflow } from "../../../AI_Skills/langGraph/workflow"; 
import { HumanMessage } from "@langchain/core/messages";

// Load environment variables - ensure they're available for Trigger.dev workers
// Try multiple paths to find .env file (relative to where Trigger.dev runs from)
const envPaths = [
  path.resolve(process.cwd(), "../../../.env"), // 3 levels up
  path.resolve(process.cwd(), "../../../../.env"), // 4 level up
  path.resolve(process.cwd(), "../../../../../.env"), // 5 levels up
];

let envLoaded = false;
for (const envPath of envPaths) {
  try {
    const result = dotenv.config({ path: envPath });
    if (!result.error && result.parsed) {
      console.log(`✅ Loaded .env from: ${envPath}`);
      envLoaded = true;
      break;
    }
  } catch (err) {
    // Continue to next path
  }
}
console.log("Environment loaded. Service Key exists?", !!process.env.SUPABASE_SERVICE_ROLE_KEY);

// 1. Define what the Queue sends (Lightweight)
export interface TriggerPayload {
  projectId: string;
  userId: string;
  input: {
    title?: string; // User-selected report title
    reportType: string;
    modelName: string; // 'grok', 'gemini', 'claude'
    selectedImageIds: string[];
    templateId: string;
    sections?: any[]; // Custom sections from frontend
    workflowType?: string; // Workflow type: 'simple', 'advanced', etc. 
  };
}

export const generateReportTask = task({
  id: "generate-report",
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    factor: 2,
  },
  run: async (payload: TriggerPayload, { ctx }) => {
    // 1. Setup Clients
    // Create a fresh Supabase client to avoid Container singleton issues in Trigger.dev
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    
    if (!supabaseUrl || !supabaseKey) {
        throw new Error("Missing Supabase credentials in environment variables");
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const reportService = Container.reportService;
    const chatRepo = Container.chatRepo;
    const chatService = Container.chatService;

    // 2. Setup Buffers
    let textBuffer = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 200; // Shorter interval so scratchpad/reasoning appears sooner
    let finalMessage = "Report generation complete!";

    

    try {
      // PRE-CALCULATE ID: We need this ID for the graph state
      const draftReportId = uuidv4();
      
      // Use workflow type from modal; only fallback to "simple" when field is missing (e.g. old client)
      const workflowType = payload.input.workflowType ?? 'simple';
      
      console.log(`🚀 Starting LangGraph for Report: ${draftReportId} using workflow: ${workflowType}`);

      // 3. SELECT THE APPROPRIATE WORKFLOW GRAPH
      const workflowGraph = getWorkflow(workflowType);

      // 4. PREPARE LANGGRAPH STATE
      // Instead of calling reportService.generateReportStream, we prepare the Graph Input
      const inputState = {
        messages: [new HumanMessage("Generate the report.")], // Trigger the graph
        context: "", // Fetch context if needed, or rely on nodes to fetch it
        projectId: payload.projectId,
        userId: payload.userId,
        reportType: payload.input.reportType,
        title: payload.input.title,
        provider: payload.input.modelName,
        selectedImageIds: payload.input.selectedImageIds,
        draftReportId: draftReportId, // Pass the ID so agents know where to write
        currentSection: "init"
      };

      // 5. RUN THE GRAPH STREAM
      // streamEvents gives us granular tokens & tool calls just like Vercel AI SDK
      const eventStream = await workflowGraph.streamEvents(inputState, {
        version: "v2", // Required for LangChain v0.2+
      });

      // 5. THE NEW LOOP (Adapting LangGraph events to your logic)
      for await (const event of eventStream) {
        
        // A. TEXT STREAMING (Reasoning)
        // Event: 'on_chat_model_stream' means the LLM is outputting tokens
        if (event.event === "on_chat_model_stream") {
          const token = event.data.chunk?.content;
          if (typeof token === "string" && token.length > 0) {
            textBuffer += token;

            // Broadcast buffer (debounce logic from your original code)
            if (Date.now() - lastUpdate > UPDATE_INTERVAL) {
              await broadcast(supabase, payload.projectId, 'reasoning', { chunk: textBuffer });
              textBuffer = "";
              lastUpdate = Date.now();
            }
          }
        }

        // B. TOOL CALLS (Status Updates)
        // Event: 'on_tool_start' means the agent decided to use a tool
        else if (event.event === "on_tool_start") {
          const toolName = event.name;
          const inputObj = event.data.input;

          const friendlyStatus = getFriendlyStatus(toolName, inputObj);
          
          // Broadcast Header
          await broadcast(supabase, payload.projectId, 'reasoning', { chunk: `\n### ${friendlyStatus}\n` });
          await broadcast(supabase, payload.projectId, 'status', { chunk: friendlyStatus });

          // Broadcast "Reasoning" field if your agent outputted it in the tool args
          if (inputObj?.reasoning) {
            await broadcast(supabase, payload.projectId, 'reasoning', { chunk: `${inputObj.reasoning}\n\n` });
          }
        }

        // C. TOOL RESULTS (Completion)
        // Event: 'on_tool_end'
        else if (event.event === "on_tool_end") {
           if (event.name === 'submit_report') {
             // Capture the final summary message
             const output = event.data.output; // This is the return value of your tool
             // Depending on how your tool returns data, it might be a string or object
             // Adjust 'output.message' based on your actual tool implementation
             finalMessage = typeof output === 'string' ? output : (output?.message || finalMessage);
           }
        }
      }

      // 6. FLUSH & FINALIZE (Keep exactly as is)
      if (textBuffer.length > 0) {
        await broadcast(supabase, payload.projectId, 'reasoning', { chunk: textBuffer });
      }

      // Compile sections -> tiptap_content
      if (draftReportId) {
        try {
          await reportService.saveReport(draftReportId, supabase);
          console.log(`✅ Report ${draftReportId} finalized.`);
        } catch (saveErr) {
          console.error(`⚠️ Failed to finalize report:`, saveErr);
        }
      }

      // Add Chat Message
      if (draftReportId) {
        await addFinalMessageToChatSession(supabase, payload.projectId, payload.userId, draftReportId, finalMessage, chatRepo, chatService);
      }

      // Broadcast Completion
      if (draftReportId) {
        await broadcast(supabase, payload.projectId, 'report_complete', {
          reportId: draftReportId,
          projectId: payload.projectId
        });
      }

      return { reportId: draftReportId, success: true };

    } catch (error) {
      console.error("❌ Task Failed:", error);
      await broadcast(supabase, payload.projectId, 'error', {
        message: error instanceof Error ? error.message : "Generation failed"
      });
      throw error;
    }
  },
});

// --- HELPERS TO KEEP THE CODE CLEAN ---

async function broadcast(supabase: any, projectId: string, event: string, payload: any) {
  return supabase.channel(`project-${projectId}`).send({
    type: 'broadcast',
    event,
    payload: { ...payload, projectId }
  });
}

function getFriendlyStatus(toolName: string, input: any): string {
  const maps: Record<string, string> = {
    'updateSection': `Writing section: ${input?.heading || input?.sectionId || 'report content'}...`,
    'analyze_batch_images': `Analyzing ${input?.imageUrls?.length || 0} images for details...`,
    'searchInternalKnowledge': `Searching project database...`,
    'searchWeb': `Researching online for ${input?.query}...`,
    'submit_report': `Finalizing report structure...`
  };
  return maps[toolName] || `Executing ${toolName}...`;
}

/**
 * Add the final report message to the chat session so the user sees it in the chat UI.
 * Gets or creates a session for this report, then adds an assistant message.
 */
async function addFinalMessageToChatSession(
  supabase: SupabaseClient,
  projectId: string,
  userId: string,
  reportId: string,
  finalMessage: string,
  chatRepo: ChatRepository,
  chatService: ChatService
): Promise<void> {
  try {
    const sessions = await chatRepo.getSessionsByProject(projectId, supabase);
    const sessionForReport = sessions.find((s) => s.reportId === reportId);

    let sessionId: string;

    if (sessionForReport) {
      sessionId = sessionForReport.sessionId;
    } else {
      const newSession = await chatService.startSession(userId, projectId, supabase, reportId);
      sessionId = newSession.sessionId;
    }

    const assistantMsg: ChatMessage = {
      messageId: uuidv4(),
      sessionId,
      sender: 'assistant',
      content: finalMessage,
      timestamp: new Date(),
    };

    await chatRepo.addMessage(sessionId, assistantMsg, supabase);
    await chatRepo.updateSessionTimestamp(sessionId, new Date(), supabase);
    console.log(`✅ Final message added to chat session ${sessionId} for report ${reportId}`);
  } catch (err) {
    console.error('Failed to add final message to chat session:', err);
    // Don't throw - report generation succeeded; chat message is best-effort
  }

}

