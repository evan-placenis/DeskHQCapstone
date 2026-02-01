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

    let textBuffer = "";
    let lastUpdate = Date.now();
    const UPDATE_INTERVAL = 200; // Shorter interval so scratchpad/reasoning appears sooner
    let finalMessage = "Report generation complete!";

    try {
      const result = await reportService.generateReportStream(
        payload.projectId,
        {
          title: payload.input.title,
          reportType: payload.input.reportType,
          modelName: payload.input.modelName,
          selectedImageIds: payload.input.selectedImageIds,
          templateId: payload.input.templateId,
          sections: payload.input.sections
        },
        supabase,
        payload.userId
      );

      const { streamResult, draftReportId } = result;

      // ONE LOOP TO RULE THEM ALL
      for await (const part of streamResult.fullStream) {
        switch (part.type) {
          case 'text-delta':
            textBuffer += part.text;
            // Stream scratchpad/reasoning: batch every UPDATE_INTERVAL so user sees reasoning as the agent types
            if (textBuffer.length > 0 && Date.now() - lastUpdate > UPDATE_INTERVAL) {
              await broadcast(supabase, payload.projectId, 'reasoning', { chunk: textBuffer });
              textBuffer = "";
              lastUpdate = Date.now();
            }
            break;

          case 'tool-call':
            // Use 'input' property for AI SDK streamText
            const toolInput = 'input' in part ? part.input : undefined;
            const inputObj = toolInput as Record<string, unknown> | undefined;


            const friendlyStatus = getFriendlyStatus(part.toolName, toolInput);
            const headerChunk = `\n\n### 🛠️ ${friendlyStatus}\n`;
            await broadcast(supabase, payload.projectId, 'reasoning', { chunk: headerChunk });

            // Stream the agent's reasoning note for this tool call (scratchpad) if provided
            if (inputObj?.reasoning && typeof inputObj.reasoning === 'string') {
              const reasoningChunk = `> *${(inputObj.reasoning as string).trim()}*\n\n`;
              await broadcast(supabase, payload.projectId, 'reasoning', {chunk: reasoningChunk});
            }

            await broadcast(supabase, payload.projectId, 'status', { chunk: friendlyStatus });
            break;

          case 'tool-result':
            // Catch the final report submission result
            if (part.toolName === 'submit_report') {
              // Narrow the type to access result property
              const toolResult = 'result' in part ? part.result : undefined;
              finalMessage = (toolResult as any)?.message || "Report finalized successfully.";
            }
            break;
        }
      }

      // Flush remaining text
      if (textBuffer.length > 0) {
        await broadcast(supabase, payload.projectId, 'reasoning', { chunk: textBuffer });
      }

      // Finalize report: compile report_sections into reports.tiptap_content so the DB column is filled
      if (draftReportId) {
        try {
          await reportService.saveReport(draftReportId, supabase);
          console.log(`✅ Report ${draftReportId} finalized: tiptap_content updated from report_sections`);
        } catch (saveErr) {
          console.error(`⚠️ Failed to finalize report (tiptap_content not updated):`, saveErr);
          // Don't throw - sections are saved; UI can still display via getReportById fallback
        }
      }

      // Add the final message to the chat session so the user sees it in chat (instead of only in the stream)
      if (draftReportId) {
        await addFinalMessageToChatSession(supabase, payload.projectId, payload.userId, draftReportId, finalMessage, chatRepo, chatService);
      }

      // BROADCAST COMPLETION: This triggers the frontend to refresh the UI
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
      sender: 'AI',
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

