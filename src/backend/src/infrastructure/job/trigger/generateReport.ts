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

// 1. Define what the Queue sends (Lightweight)
export interface TriggerPayload {
  projectId?: string;
  userId: string;
  reportId?: string; // For resume actions OR pre-generated ID for new reports
  action?: "start" | "resume"; // Action type
  approvalStatus?: "APPROVED" | "REJECTED"; // For resume actions
  userFeedback?: string; // For resume actions
  input?: {
    reportId?: string; // Pre-generated reportId from API route
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
          status: 'DRAFT',
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
        messages: [new HumanMessage("Generate the report.")], // Trigger the graph
        context: contextPrompt, // System prompt from template
        projectId: payload.projectId,
        userId: payload.userId,
        reportType: payload.input.reportType,
        title: payload.input.title,
        provider: payload.input.modelName,
        selectedImageIds: payload.input.selectedImageIds,
        draftReportId: draftReportId, // Pass the ID so agents know where to write
        client: supabase, // Pass Supabase client for database operations
        photoNotes: "", // Optional: Could come from frontend in future
        structureInstructions: structureInstructions, // From template
        currentSection: "init"
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
      for await (const event of eventStream) {
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

  // 1. RAW TOKEN STREAMING
  if (event.event === "on_chat_model_stream") {
    const token = event.data.chunk?.content;
    if (typeof token === "string" && token.length > 0) {
      updatedBuffer += token;
    }
  } 

  // 2. TOOL CALL STREAMING (The Logic Hub)
  else if (event.event === "on_tool_start") {
    
    // 🛠️ DATA EXTRACTION (Gemini Fix)
    let args = event.data.input;
    if (typeof args === 'string') {
      try {
        args = JSON.parse(args);
        console.log("✅ JSON parsed successfully from string.");
      } catch (e) {
        console.log("⚠️ Input was string but NOT JSON.");
      }
    } else if (args?.input && typeof args.input === 'string') {
      try {
        args = JSON.parse(args.input);
        console.log("✅ JSON parsed from nested input string.");
      } catch (e) {}
    }

    const reasoning = args?.reasoning;
    if (reasoning) console.log(` "${reasoning.substring(0, 50)}..."`);

    // 🛠️ ADAPTER CHECK
    const friendlyStatus = streamingAdapter.getFriendlyStatus(event.name, args);

    if (friendlyStatus) {
      // BROADCAST 1: The Thought
      if (reasoning) {
        const thoughtProcess = `\n\n **Reasoning:** *${reasoning}*\n\n`;
        await broadcast(supabase, projectId, 'reasoning', { chunk: thoughtProcess });
      }

      // BROADCAST 2: The UI Bar
      await broadcast(supabase, projectId, 'status', { chunk: friendlyStatus });

      // BROADCAST 3: The Header
      const actionHeader = `#### ${friendlyStatus}\n`;
      await broadcast(supabase, projectId, 'reasoning', { chunk: actionHeader });
      
    }
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

    for await (const event of eventStream) {
      textBuffer = await processStreamEvent({
        event,
        supabase,
        projectId: projectId!,
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

