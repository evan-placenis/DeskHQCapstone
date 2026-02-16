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
import { getWorkflow } from "../../../AI_Skills/LangGraph/workflow"; 
import { HumanMessage } from "@langchain/core/messages";
import { StreamingAdapter } from "../../../AI_Skills/LangGraph/utils/streaming-adapter";

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

// Set to true to log every stream event and reasoning extraction (helps debug missing reasoning)
const STREAM_DEBUG = process.env.STREAM_DEBUG === 'true' || process.env.DEBUG_STREAM === 'true';

// 1. Define what the Queue sends (Lightweight)
export interface TriggerPayload {
  projectId?: string;
  userId: string;
  reportId?: string; // For resume actions OR pre-generated ID for new reports
  action?: "start" | "resume"; // Action type
  approvalStatus?: "APPROVED" | "REJECTED"; // For resume actions
  userFeedback?: string; // For resume actions
  input?: {
    reportId?: string;
    title?: string;
    reportType: string;
    modelName: string;
    selectedImageIds: string[];
    templateId: string;
    sections?: any[]; // Custom sections from frontend
    workflowType?: string;
    processingMode?: 'TEXT_ONLY' | 'IMAGE_AND_TEXT'; // From NewReportModal: TEXT_ONLY = no vision tools
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

    // 2. Check if this is a RESUME action
    if (payload.action === "resume" && payload.reportId) {
      console.log(`🔄 RESUME ACTION: Resuming report ${payload.reportId} with status ${payload.approvalStatus}`);
      return await handleResumeAction(payload, supabase);
    }

    // 3. Otherwise, this is a START action (new report generation)
    console.log(`🚀 START ACTION: Beginning new report generation`);

    // 4. Setup Buffers
    let textBuffer = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 200; // Shorter interval so scratchpad/reasoning appears sooner
    let finalMessage = "Report generation complete!";

    

    try {
      if (!payload.projectId || !payload.input) {
        throw new Error("Missing projectId or input for new report generation");
      }
      // Use pre-generated ID from API route, or generate a new one as fallback
      const draftReportId = payload.input.reportId || uuidv4();
      
      // Use workflow type from modal; only fallback to "simple" when field is missing (e.g. old client)
      const workflowType = payload.input.workflowType ?? 'simple';
      
      console.log(`🚀 Starting LangGraph for Report: ${draftReportId} using workflow: ${workflowType}`);

      // 3. FETCH PROJECT TO GET ORGANIZATION_ID
      const { data: project, error: projectError } = await supabase
        .from('projects')
        .select('organization_id')
        .eq('id', payload.projectId)
        .single();

      if (projectError || !project) {
        throw new Error(`Failed to fetch project: ${projectError?.message || 'Project not found'}`);
      }

      const organizationId = project.organization_id;

      // 4. CREATE DRAFT REPORT IN DATABASE (so we can save plan to it later)
      const title = payload.input.title?.trim() 
        ? payload.input.title.trim() 
        : `${payload.input.reportType} Report (Draft)`;
      
      const { error: createError } = await supabase
        .from('reports')
        .upsert({
          id: draftReportId,
          organization_id: organizationId,
          project_id: payload.projectId,
          title: title,
          status: 'GENERATING',
          template_id: payload.input.templateId || null,
          created_by: payload.userId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          version_number: 1
        });

      if (createError) {
        console.error('❌ Failed to create draft report:', createError);
        throw new Error(`Failed to create draft report: ${createError.message}`);
      }

      console.log(`📝 Draft report ${draftReportId} created in database`);

      // 5. FETCH TEMPLATE FOR CONTEXT (if using observation workflow)
      let contextPrompt = "";
      let structureInstructions = "";
      
      if (workflowType === 'observation' && payload.input.templateId) {
        try {
          const { data: template } = await supabase
            .from('report_templates')
            .select('system_prompt, structure_instructions')
            .eq('id', payload.input.templateId)
            .single();
          
          if (template) {
            contextPrompt = template.system_prompt || "";
            structureInstructions = template.structure_instructions || "";
            console.log(`📋 Loaded template context for observation workflow`);
          }
        } catch (err) {
          console.warn('⚠️ Could not load template, using defaults:', err);
        }
      }

      // 6. SELECT THE APPROPRIATE WORKFLOW GRAPH
      const workflowGraph = getWorkflow(workflowType);

      // 7. PREPARE LANGGRAPH STATE
      // Instead of calling reportService.generateReportStream, we prepare the Graph Input
      const inputState = {
        messages: [new HumanMessage("Generate the report.")],
        context: contextPrompt,
        projectId: payload.projectId,
        userId: payload.userId,
        reportType: payload.input.reportType,
        title: payload.input.title,
        provider: payload.input.modelName,
        selectedImageIds: payload.input.selectedImageIds,
        draftReportId: draftReportId,
        client: supabase,
        photoNotes: "",
        structureInstructions: structureInstructions,
        currentSection: "init",
        processingMode: payload.input.processingMode ?? "IMAGE_AND_TEXT", // TEXT_ONLY = no vision tools
      };

      // 8. RUN THE GRAPH STREAM
      // streamEvents gives us granular tokens & tool calls just like Vercel AI SDK
      const eventStream = await workflowGraph.streamEvents(inputState, {
        version: "v2", // Required for LangChain v0.2+
        recursionLimit: 200, // Increase for observation workflow with multiple sections
        configurable: {
          thread_id: draftReportId, // CRITICAL: Links this execution to reportId for resume
        },
      });
      const streamingAdapter = new StreamingAdapter();

      // 9. THE NEW LOOP (Adapting LangGraph events to your logic)
      let eventCount = 0;
      for await (const event of eventStream) {
        eventCount++;
        if (STREAM_DEBUG) {
          const eventType = (event as any).event;
          const dataKeys = event?.data ? Object.keys((event as any).data) : [];
          console.log(`[STREAM #${eventCount}] event="${eventType}" dataKeys=[${dataKeys.join(', ')}]`);
        }
        textBuffer = await processStreamEvent({
          event,
          supabase,
          projectId: payload.projectId!,
          textBuffer,
          streamingAdapter
        });
        // Debounced reasoning broadcast (so text flows smoothly)
        if (textBuffer.length > 0 && Date.now() - lastUpdate > UPDATE_INTERVAL) {
          await broadcast(supabase, payload.projectId!, 'reasoning', { chunk: textBuffer });
          textBuffer = "";
          lastUpdate = Date.now();
        }
      }
      if (STREAM_DEBUG) console.log(`[STREAM] Total events processed: ${eventCount}`);

      // 11. CHECK IF GRAPH PAUSED (Human-in-the-Loop)
      // After the event stream ends, check if we paused at human_approval
      try {
        const currentState = await workflowGraph.getState({
          configurable: { thread_id: draftReportId }
        });

        // If approvalStatus is PENDING, the graph paused for human approval
        if (currentState?.values?.approvalStatus === 'PENDING' && currentState?.values?.reportPlan) {
          console.log('⏸️ Graph paused for human approval, broadcasting to frontend');
          
          await broadcast(supabase, payload.projectId, 'paused', {
            reportId: draftReportId,
            reportPlan: currentState.values.reportPlan,
            projectId: payload.projectId
          });

          // Don't finalize or mark as complete - wait for resume
          return { 
            reportId: draftReportId, 
            success: true, 
            paused: true,
            message: 'Report generation paused for human approval'
          };
        }
      } catch (stateErr) {
        console.error('⚠️ Could not check graph state:', stateErr);
        // Continue with normal completion if state check fails
      }

      // 12. NORMAL COMPLETION (Graph finished without pausing)
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
      if (payload.projectId) {
        await broadcast(supabase, payload.projectId, 'error', {
          message: error instanceof Error ? error.message : "Generation failed"
        });
      }
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

/**
 * Centralized logic to handle LangGraph events and broadcast them to the frontend.
 * This ensures "Start" and "Resume" actions look identical to the user.
 */
async function processStreamEvent({
  event,
  supabase,
  projectId,
  textBuffer,
  streamingAdapter,
}: {
  event: any;
  supabase: SupabaseClient;
  projectId: string;
  textBuffer: string;
  streamingAdapter: StreamingAdapter;
}): Promise<string> {
  let updatedBuffer = textBuffer;
  const data = event?.data ?? {};
  const evName = event?.name ?? data?.name ?? data?.tool ?? 'unknown';
  const evType = event?.event;

  // 1. RAW TOKEN STREAMING
  if (evType === "on_chat_model_stream") {
    const token = data.chunk?.content ?? data.content;
    if (typeof token === "string" && token.length > 0) {
      updatedBuffer += token;
      if (STREAM_DEBUG && updatedBuffer.length <= 200) {
        console.log(`[STREAM] token chunk (${token.length} chars): "${token.slice(0, 80)}..."`);
      }
    } else if (STREAM_DEBUG && data.chunk) {
      console.log(`[STREAM] on_chat_model_stream chunk keys:`, Object.keys(data.chunk));
    }
  }

  // 2. TOOL CALL STREAMING (The Logic Hub)
  else if (evType === "on_tool_start") {
    if (STREAM_DEBUG) {
      console.log(`[STREAM] on_tool_start name="${evName}" data keys:`, Object.keys(data));
      console.log(`[STREAM] raw data.input type:`, typeof data.input, Array.isArray(data.input) ? 'array' : '');
      if (data.input !== undefined) {
        const raw = typeof data.input === 'string' ? data.input.slice(0, 200) : JSON.stringify(data.input).slice(0, 200);
        console.log(`[STREAM] raw data.input preview:`, raw);
      }
    }

    // Try multiple possible locations for tool args (model-dependent)
    let args = data.input ?? data.args ?? data;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
        if (STREAM_DEBUG) console.log("[STREAM] Parsed args from string, keys:", Object.keys(args || {}));
      } catch (e) {
        if (STREAM_DEBUG) console.log("[STREAM] data.input was string but NOT valid JSON:", (e as Error).message);
      }
    } else if (args?.input && typeof args.input === 'string') {
      try {
        args = JSON.parse(args.input);
        if (STREAM_DEBUG) console.log("[STREAM] Parsed args from nested .input, keys:", Object.keys(args || {}));
      } catch (e) {}
    }

    const reasoning = args?.reasoning ?? args?.reason ?? args?.scratchpad;
    if (STREAM_DEBUG) {
      console.log(`[STREAM] tool="${evName}" reasoning present: ${!!reasoning}`, reasoning ? `value length=${String(reasoning).length}` : '');
      if (args && !reasoning) console.log("[STREAM] args keys (no reasoning found):", Object.keys(args));
    }
    if (reasoning) {
      console.log(`[STREAM] 💭 Reasoning (${evName}): "${String(reasoning).substring(0, 80)}..."`);
    }

    const friendlyStatus = streamingAdapter.getFriendlyStatus(evName, args);

    if (friendlyStatus) {
      if (reasoning) {
        const thoughtProcess = `\n\n **Reasoning:** *${reasoning}*\n\n`;
        await broadcast(supabase, projectId, 'reasoning', { chunk: thoughtProcess });
        if (STREAM_DEBUG) console.log(`[STREAM] Broadcast reasoning chunk (${thoughtProcess.length} chars)`);
      }
      await broadcast(supabase, projectId, 'status', { chunk: friendlyStatus });
      const actionHeader = `#### ${friendlyStatus}\n`;
      await broadcast(supabase, projectId, 'reasoning', { chunk: actionHeader });
    } else if (STREAM_DEBUG && evName) {
      console.log(`[STREAM] No friendlyStatus for tool "${evName}" (adapter returned null)`);
    }
  }

  // Debug: log other event types so we can see if reasoning comes from elsewhere
  else if (STREAM_DEBUG && evType && !evType.includes('chat_model')) {
    console.log(`[STREAM] Unhandled event type: "${evType}" name="${evName}"`);
  }

  return updatedBuffer;
}
/**
 * Handle RESUME action - resumes a paused LangGraph workflow after human approval
 */
async function handleResumeAction(
  payload: TriggerPayload,
  supabase: SupabaseClient
): Promise<any> {
  const { reportId, approvalStatus, userFeedback } = payload;

  if (!reportId) {
    throw new Error("reportId is required for resume action");
  }

  try {
    console.log(`🔄 Resuming workflow for report ${reportId}`);
    console.log(`📋 Approval status: ${approvalStatus}`);
    if (userFeedback) {
      console.log(`💬 User feedback: ${userFeedback}`);
    }

    // 1. Get the workflow graph (observation workflow has checkpointer)
    const workflowGraph = getWorkflow('observation');

    // 2. Config with thread_id = reportId (how LangGraph tracks executions)
    const config = {
      configurable: {
        thread_id: reportId,
      },
    };

    // 3. Update the paused state with user's decision
    await workflowGraph.updateState(config, {
      approvalStatus,
      userFeedback: userFeedback || '',
      next_step: approvalStatus === 'REJECTED' ? 'architect' : 'builder',
    });

    console.log(`✅ State updated for thread ${reportId}`);

    // 4. Get projectId from the report for broadcasting
    const { data: report } = await supabase
      .from('reports')
      .select('project_id')
      .eq('id', reportId)
      .single();

    const projectId = report?.project_id;
    if (!projectId) {
      console.warn('⚠️ Could not find projectId for broadcasting');
    }

    // 5. Resume the graph execution
    const eventStream = await workflowGraph.streamEvents(null, {
      ...config,
      version: "v2",
      recursionLimit: 200,
    });

    console.log(`🚀 Graph resumed for thread ${reportId}`);

    // 6. Stream events and broadcast (same as initial generation)
    let textBuffer = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 200;
    const streamingAdapter = new StreamingAdapter();
    let resumeEventCount = 0;

    for await (const event of eventStream) {
      resumeEventCount++;
      if (STREAM_DEBUG) {
        const eventType = (event as any).event;
        const dataKeys = (event as any).data ? Object.keys((event as any).data) : [];
        console.log(`[STREAM resume #${resumeEventCount}] event="${eventType}" dataKeys=[${dataKeys.join(', ')}]`);
      }
      textBuffer = await processStreamEvent({
        event,
        supabase,
        projectId: projectId!,
        textBuffer,
        streamingAdapter
      });
      if (textBuffer.length > 0 && projectId && Date.now() - lastUpdate > UPDATE_INTERVAL) {
        await broadcast(supabase, projectId, 'reasoning', { chunk: textBuffer });
        textBuffer = "";
        lastUpdate = Date.now();
      }
    }
    if (STREAM_DEBUG) console.log(`[STREAM resume] Total events: ${resumeEventCount}`);

    // 7. Flush remaining buffer
    if (textBuffer.length > 0 && projectId) {
      await broadcast(supabase, projectId, 'reasoning', { chunk: textBuffer });
    }

    // 8. Check if we paused again (rejection cycle)
    const currentState = await workflowGraph.getState(config);
    
    if (currentState?.values?.approvalStatus === 'PENDING' && currentState?.values?.reportPlan) {
      console.log('⏸️ Graph paused again for revised plan approval');
      
      if (projectId) {
        await broadcast(supabase, projectId, 'paused', {
          reportId: reportId,
          reportPlan: currentState.values.reportPlan,
          projectId: projectId
        });
      }

      return { 
        reportId, 
        success: true, 
        paused: true,
        message: 'Report generation paused for revised plan approval'
      };
    }

    // 9. Normal completion - finalize report
    const reportService = Container.reportService;
    await reportService.saveReport(reportId, supabase);
    console.log(`✅ Report ${reportId} finalized after resume`);

    // 10. Broadcast completion
    if (projectId) {
      await broadcast(supabase, projectId, 'report_complete', {
        reportId: reportId,
        projectId: projectId
      });
    }

    return { 
      reportId, 
      success: true,
      message: 'Report generation completed successfully'
    };

  } catch (error) {
    console.error(`❌ Resume failed for ${reportId}:`, error);
    
    // Broadcast error to frontend
    const { data: report } = await supabase
      .from('reports')
      .select('project_id')
      .eq('id', reportId)
      .single();

    if (report?.project_id) {
      await broadcast(supabase, report.project_id, 'error', {
        message: error instanceof Error ? error.message : "Resume failed"
      });
    }

    throw error;
  }
}

