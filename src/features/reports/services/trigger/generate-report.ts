import { task } from "@trigger.dev/sdk/v3";
import { Container } from "@/lib/container";
import { v4 as uuidv4 } from "uuid";
import { Report } from "@/features/reports/services/domain-reports/report-types";
import { ChatMessage } from "@/features/chat/services/domain-chat/chat-types";
import type { ChatRepository } from "@/features/chat/services/chat-repository";
import type { ChatService } from "@/features/chat/services/chat-service";
import dotenv from "dotenv";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

import { getWorkflow } from "@/features/ai/services/report-generation/workflow";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { StreamingAdapter } from "@/features/ai/services/report-generation/utils/streaming-adapter";
import { getFlattenedTasks } from "@/features/ai/services/report-generation/nodes/report/observation/builder-node";
import { HeliconeContextBuilder, type HeliconeContextInput } from "@/features/ai/services/gateway/helicone-context-builder";

// Load .env from cwd (repo root when you run Trigger from the project)
const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "..", ".env"),
  path.resolve(process.cwd(), "..", "..", ".env"),
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
  /** User answers to architect's clarification questions (index matches user_questions in reportPlan) */
  userClarification?: string[];
  /** When user approves (possibly after editing), frontend sends the plan to use. Builder uses this directly. */
  modifiedPlan?: { sections: any[]; strategy?: string; reasoning?: string };
  /** Serialized HeliconeContextInput — worker calls .build() locally to avoid leaking the API key. */
  heliconeContext?: string;
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
      let system_prompt = "";
      let structureInstructions = "";

      // --- LOGGING: Trace whether frontend sent templateId and whether DB fetch succeeds ---
      const rawTemplateId = payload.input.templateId;
      const hasTemplateId = Boolean(rawTemplateId?.trim?.() ?? rawTemplateId);


      if (hasTemplateId) {
        const templateIdToFetch = (typeof rawTemplateId === "string" ? rawTemplateId.trim() : String(rawTemplateId));
        try {
          const { data: template, error: templateError } = await supabase
            .from('report_templates')
            .select('system_prompt, structure_instructions')
            .eq('id', templateIdToFetch)
            .single();

          if (templateError) {
            console.error(`❌ [Template] Supabase error: code=${templateError.code}, message=${templateError.message}, details=${JSON.stringify(templateError.details)}`);
          }
          if (template) {
            system_prompt = template.system_prompt || "";
            structureInstructions = template.structure_instructions || "";
            console.log(`📋 [Template] Loaded template: system_prompt length=${system_prompt.length}, structure_instructions length=${structureInstructions.length}`);
          } else {
            console.log(`🔍 [Template] No row returned (data is null/undefined). Check that id exists in report_templates.`);
          }
        } catch (err) {
          console.warn('⚠️ [Template] Exception while loading template, using defaults:', err);
        }
      }
      // 6. SELECT THE APPROPRIATE WORKFLOW GRAPH
      const workflowGraph = getWorkflow(workflowType);

      // 7. PREPARE LANGGRAPH STATE
      // Use explicit strings so state never has undefined for systemPrompt/structureInstructions (builder/architect expect them)
      let heliconeInput: HeliconeContextInput | undefined;
      if (payload.heliconeContext) {
        try {
          heliconeInput = HeliconeContextBuilder.deserializeForTrigger(payload.heliconeContext);
        } catch (err) {
          console.warn('[Helicone] Failed to deserialize context in worker, proceeding without tracking:', err);
        }
      }

      const inputState = {
        messages: [new HumanMessage("Generate the report.")],
        systemPrompt: system_prompt ?? "",
        projectId: payload.projectId,
        userId: payload.userId,
        reportType: payload.input.reportType,
        reportTitle: title,
        provider: payload.input.modelName,
        selectedImageIds: payload.input.selectedImageIds,
        draftReportId: draftReportId,
        client: supabase,
        photoNotes: "",
        structureInstructions: structureInstructions ?? "",
        currentSection: "init",
        processingMode: payload.input.processingMode ?? "IMAGE_AND_TEXT",
        heliconeInput,
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

      // 9. Send initial status (with small delay to ensure frontend is subscribed)
      // Give frontend time to subscribe before sending first broadcast
      console.log(`⏳ Waiting 1 second for frontend subscription to channel project-${payload.projectId}...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`📤 Sending initial status broadcast...`);
      await broadcast(supabase, payload.projectId!, 'status', { chunk: 'Starting report generation...' });
      console.log(`✅ Initial status broadcast sent`);

      // 10. EVENT LOOP
      // Nodes now broadcast their own reasoning tokens directly via createNodeBroadcaster.
      // This loop only handles structural events: node starts, tool status, completion.
      for await (const event of eventStream) {
        await processStreamEvent({
          event,
          supabase,
          projectId: payload.projectId!,
          streamingAdapter,
        });
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

/** Send broadcast via REST (httpSend) so server/worker delivery is explicit and reliable. */
async function broadcast(supabase: any, projectId: string, event: string, payload: any) {
  const channelName = `project-${projectId}`;
  const channel = supabase.channel(channelName);
  const body = { ...payload, projectId };
  return channel.httpSend(event, body).catch((err: unknown) => {
    console.warn(`[Broadcast] ${event} failed:`, err);
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
// --- REPLACEMENT HELPER ---

/**
 * Handles a single LangGraph stream event, broadcasting status and tool
 * notifications to the frontend.
 *
 * Token-level streaming (`agent_thought`) is no longer handled here —
 * each node broadcasts its own reasoning tokens directly via
 * `createNodeBroadcaster` as part of its Phase 1 streaming loop.
 * This avoids the Gemini "Failed to parse stream" error caused by
 * LangGraph's `streamEvents` forcing tool-call JSON through the SSE parser.
 */
async function processStreamEvent({
  event,
  supabase,
  projectId,
  streamingAdapter,
}: {
  event: any;
  supabase: SupabaseClient;
  projectId: string;
  streamingAdapter: StreamingAdapter;
}): Promise<void> {
  // ─────────────────────────────────────────────────────────────────────────
  // 1. NODE START — broadcast a friendly status message
  // ─────────────────────────────────────────────────────────────────────────
  if (event.event === "on_chain_start" && event.name && event.name !== "LangGraph") {
    const nodeStatus = streamingAdapter.onNodeStart(event.name);
    if (nodeStatus) {
      await broadcast(supabase, projectId, 'status', { chunk: nodeStatus });
    }
    await broadcast(supabase, projectId, 'debug_node', { node: event.name });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. TOOL START — status bar update
  // ─────────────────────────────────────────────────────────────────────────
  else if (event.event === "on_tool_start") {
    const toolName = event.name;
    let toolInput = event.data?.input;

    // Normalize nested or stringified inputs (Gemini / OpenAI / Claude differences)
    if (toolInput?.input) toolInput = toolInput.input;
    if (typeof toolInput === 'string') {
      try { toolInput = JSON.parse(toolInput); } catch { /* use as-is */ }
    }

    const statusMessage = streamingAdapter.getFriendlyStatus(toolName, toolInput);
    if (statusMessage) {
      await broadcast(supabase, projectId, 'status', { chunk: statusMessage });
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. TOOL END — status bar completion messages
  // ─────────────────────────────────────────────────────────────────────────
  else if (event.event === "on_tool_end") {
    if (event.name === 'searchInternalKnowledge') {
      await broadcast(supabase, projectId, 'status', { chunk: "Search complete. Analyzing results..." });
    } else if (event.name === 'writeSection') {
      await broadcast(supabase, projectId, 'status', { chunk: "Section saved successfully." });
    }
  }
}



/**
 * Handle RESUME action - resumes a paused LangGraph workflow after human approval
 */
async function handleResumeAction(
  payload: TriggerPayload,
  supabase: SupabaseClient
): Promise<any> {
  const { reportId, approvalStatus, userFeedback, userClarification } = payload;

  if (!reportId) {
    throw new Error("reportId is required for resume action");
  }

  try {
    console.log(`🔄 Resuming workflow for report ${reportId}`);
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

    // 3. Get current state to preserve draftReportId
    const pausedState = await workflowGraph.getState(config);
    const existingDraftReportId = pausedState?.values?.draftReportId || reportId;

    // 4. Update the paused state with user's decision
    // When APPROVED, use the frontend's plan (edited or not) so the builder writes from that structure
    const stateUpdate: Record<string, unknown> = {
      approvalStatus,
      userFeedback: userFeedback || '',
      userClarification: userClarification ?? [],
      next_step: approvalStatus === 'REJECTED' ? 'architect' : 'builder',
      draftReportId: existingDraftReportId, // CRITICAL: Preserve reportId so builder can write sections
    };
    if (approvalStatus === 'APPROVED' && payload.modifiedPlan?.sections) {
      stateUpdate.reportPlan = payload.modifiedPlan;
      console.log(`📋 Using frontend plan (${payload.modifiedPlan.sections.length} sections) for builder`);
    }

    // When resuming after APPROVAL: replace messages with minimal context so the builder isn't confused
    // by full architect/approval history (avoids "AI thinks it already did the work" or duplicate behavior).
    if (approvalStatus === 'APPROVED') {
      const plan = (stateUpdate.reportPlan as { sections?: any[] }) ?? pausedState?.values?.reportPlan;
      const sections = plan?.sections ?? [];
      const currentSectionIndex = (pausedState?.values?.currentSectionIndex as number) ?? 0;
      const tasks = getFlattenedTasks(sections);
      const currentTask = tasks[currentSectionIndex];
      const currentTaskTitle = currentTask?.title ?? "Current section";
      stateUpdate.messages = {
        __replace: true,
        value: [
          new SystemMessage("You are resuming the report after plan approval. Proceed to write the current section only."),
          new HumanMessage(`Current Task: ${currentTaskTitle}`),
        ],
      };
      console.log(`📝 [Resume] Replaced messages with resume context; current task: ${currentTaskTitle}`);
    }

    // 4. Get projectId and optionally re-inject template context (checkpoint may not persist systemPrompt/structureInstructions)
    const { data: report } = await supabase
      .from('reports')
      .select('project_id, template_id')
      .eq('id', reportId)
      .single();

    const projectId = report?.project_id;
    if (report?.template_id) {
      try {
        const { data: template } = await supabase
          .from('report_templates')
          .select('system_prompt, structure_instructions')
          .eq('id', report.template_id)
          .single();
        if (template) {
          stateUpdate.systemPrompt = template.system_prompt ?? "";
          stateUpdate.structureInstructions = template.structure_instructions ?? "";
          console.log("📋 [Resume] Re-injecting template context (systemPrompt/structureInstructions) into state");
        }
      } catch (err) {
        console.warn("⚠️ [Resume] Could not load template for context:", err);
      }
    }

    console.log(`🔍 [Resume] Setting draftReportId in state: "${existingDraftReportId}"`);
    await workflowGraph.updateState(config, stateUpdate);

    console.log(`✅ State updated for thread ${reportId}`);
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

    // 6. Stream events — nodes broadcast their own reasoning tokens directly
    const streamingAdapter = new StreamingAdapter();

    for await (const event of eventStream) {
      await processStreamEvent({
        event,
        supabase,
        projectId: projectId!,
        streamingAdapter,
      });
    }

    // 8. Check if we paused again (rejection cycle)
    const finalState = await workflowGraph.getState(config);

    if (finalState?.values?.approvalStatus === 'PENDING' && finalState?.values?.reportPlan) {
      console.log('⏸️ Graph paused again for revised plan approval');

      if (projectId) {
        await broadcast(supabase, projectId, 'paused', {
          reportId: reportId,
          reportPlan: finalState.values.reportPlan,
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

