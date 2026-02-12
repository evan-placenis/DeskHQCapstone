
import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { Container } from '../../config/container'; // Your generic Supabase server client
import { getWorkflow } from '../LangGraph/workflow'; // Dynamic workflow selector
import { CustomLangChainAdapter } from '../LangGraph/utils/custom-adapter';

import { SupabaseClient } from "@supabase/supabase-js";
interface GenerateParams {
  messages: any[];
  context: string;
  projectId: string;
  userId: string;
  reportType?: string;
  provider?: 'grok' | 'gemini-pro' | 'claude'| 'gemini-cheap';
  draftReportId: string, 
  selectedImageIds?: string[];
  workflowType?: string;
  client: SupabaseClient; // Pass the client explicitly
}

export const maxDuration = 60; // Allow long running agents

export class ReportOrchestrator {
  
  /**
   * Generates a report stream using the LangGraph engine.
   */
  async generateStream(params: GenerateParams) {
    const { 
      messages, context, projectId, userId, reportType, 
      provider, selectedImageIds, workflowType, client 
    } = params;

    // 1. Convert Messages (Logic decoupled from HTTP)
    const langChainMessages = messages.map((m: any) => 
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // 2. Initialize State
    const inputState = {
      messages: langChainMessages,
      context: context || "",
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





// import { streamText, stepCountIs, tool } from 'ai';
// import { ModelStrategy } from '../Models/model-strategy';
// import { reportSkills } from '../skills/report.skills';
// import { visionSkills } from '../skills/vison.skills';
// import { researchSkills } from '../skills/research.skills';
// import { z } from 'zod';
// import { SupabaseClient } from '@supabase/supabase-js';

// export class ReportOrchestrator {
//   async generateStream(params: {
//     messages: any[];
//     context: string;
//     projectId: string;
//     userId: string;
//     reportType: string;
//     provider: 'grok' | 'gemini-pro' | 'claude'| 'gemini-cheap';
//     draftReportId?: string; // Draft report ID for incremental writing
//     selectedImageIds?: string[]; // User-selected image IDs to limit analysis
//     client: SupabaseClient;
//   }) {
//     const { messages, context, projectId, userId, provider, draftReportId, selectedImageIds, client } = params;

//     // 1. Define your Static "Guardrails" (The mechanics of how to be an agent)
//     const AGENT_MECHANICS = `
//     You are an expert technical writer and building inspector.

//     CORE BEHAVIORS:
//     1. ANALYZE FIRST: Gather image IDs/URLs first. Use 'getProjectSpecs' before writing.
//     2. INCREMENTAL WRITING: Do NOT output report text in chat. ONLY use 'updateSection'.
//     3. SECTION IDs: Use exact 'sectionId'.
//     4. ITERATE: You should review your work once you finished a rought copy of the report. You can call 'getReportStructure' to read your work and 'updateSection' multiple times for the same section to refine it.
//     5. FINISH: Call 'submit_report' when done.

//     SCRATCHPAD (so the user can follow your reasoning):
//     - You will be provided a scratchpat to output brief reasoning. This stream is shown to the user in real time.
//     - When calling a tool, you may pass an optional "reasoning" field: explain your thought process, please state what section you are working on at the beginning.

//     DEBUGGING:
//     - Call 'getReportStructure' if unsure.
//     - If images fail, describe based on metadata.
//     `;

//     // 2. Merge them! (Mechanics first, then Context)
//     const FINAL_SYSTEM_PROMPT = `
//     ${AGENT_MECHANICS}

//     ---
//     PROJECT CONTEXT & TEMPLATE:
//     ${context} 
//     `;

//     // 1. Sanitize Messages
//     // Ensure we strictly follow the OpenAI message format { role, content }
//     const sanitizedMessages = messages
//       .filter(msg => msg && (msg.role ?? msg.sender) && msg.content !== undefined)
//       .map(msg => ({
//         role: (msg.role ?? msg.sender) as 'user' | 'assistant',
//         content: typeof msg.content === 'string' ? msg.content : String(msg.content || '')
//       }));

//     if (sanitizedMessages.length === 0) {
//       throw new Error("No valid messages provided for report generation");
//     }

//     console.log(`📨 Orchestrator: Starting stream with ${sanitizedMessages.length} messages using ${provider}`);


//     return streamText({ //maybe streamObject is better?
//       model: ModelStrategy.getModel(provider),
//       messages: sanitizedMessages,

//       stopWhen: stepCountIs(50),
//       system: FINAL_SYSTEM_PROMPT,
      

//       tools: {
//         ...reportSkills(projectId, userId, client, selectedImageIds ?? []), // Factory function - pass context + selected images
//         ...visionSkills,
//         ...researchSkills,

//         // 2. The Final Handshake
//         // This tool doesn't "save" the report itself (the sections are already saved).
//         // It just signals the end of the thought process.
//         submit_report: tool({
//           description: `Call this ONLY when ALL required sections have been successfully written to the database via 'updateSection'.`,
//           inputSchema: z.object({
//             summary: z.string().describe("A brief summary of what was accomplished and important reasoning you used to write the report"),
//             final_status: z.enum(['success', 'incomplete']).describe("Did you finish everything?")
//           }),
//           execute: async ({ summary, final_status }) => {
//             console.log(`🏁 Orchestrator: AI submitted report. Status: ${final_status}. Summary: ${summary}`);

//             // We return this metadata so the frontend/Trigger.dev knows we are done.
//             // The actual stitching happens in the ReportService.saveReport() call 
//             // which is triggered by the Trigger.dev task after this stream ends.
//             return {
//               toolName: 'submit_report', // Explicitly naming for easier parsing
//               message: "Report submission received. Initiating final compilation.",
//               summary,
//               status: final_status,
//               draftReportId
//             };
//           }
//         })
//       },
//     });
//   }
// }

// // system: `You are an expert Technical Inspector.

// //           CORE BEHAVIORS:
// //           1. 🔍 DISCOVERY (MANDATORY): 
// //              - Call 'listProjectImages' FIRST to see available evidence. 
// //              - Call 'getProjectSpecs' to get context and organization details.
// //              - If images exist, call 'getProjectImages' (using the organizationId) to access them.
// //              - Use 'vision_tool' on the returned URLs.
          
// //           2. ✍️ INCREMENTAL WRITING: 
// //              - Do NOT output report text to the chat.
// //              - ONLY use the 'updateSection' tool to write content.
// //              - Do NOT include the main Section Title (e.g., "# Observations") in the 'content' field; the system adds this.
          
// //           3. 🧱 STRUCTURE:
// //              - Use sensible section IDs: 'exec-summary', 'site-conditions', 'observations', 'recommendations'.
// //              - For Observations, use Markdown Tables strictly (no list syntax inside tables).
          
// //           4. 🏁 FINISH: 
// //              - When ALL sections are saved via tools, call 'submit_report'.`,