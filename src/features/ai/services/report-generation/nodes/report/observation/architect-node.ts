import { SystemMessage, AIMessage, ToolMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/model-strategy";
import { Container } from "@/lib/container";
import { ObservationState } from "../../../state/pretium/observation-state";
import { dumpAgentContext } from "../../../utils/agent-logger";
import { planningTools } from "@/features/ai/tools/report-generation-planning-tool";
import { extractTextContent } from "../../../utils/streaming-adapter";
import { broadcastChunkedReasoning } from "../../../utils/node-broadcast";
import path from 'path';
import fs from 'fs';
import { logger } from "@/lib/logger";
/**
 * Phase 1: The Architect
 * * Analyzes inputs (photos, notes, instructions) and proposes a Report Plan.
 * Does NOT write content yet - just organizes structure.
 */
export async function architectNode(state: typeof ObservationState.State) {
  const { 
    imageList,            // ✅ NEW: Pre-fetched rich data
    systemPrompt,
    structureInstructions, 
    provider, 
    reportPlan: inputPlan, // <--- Rename to avoid confusion
    userFeedback,
    draftReportId,
    reportTitle,
    client,
    heliconeInput,
  } = state;
  // 1. LOAD THE STATIC SKILLS
  // Repo-root skills/ — run Trigger from project root (see trigger.config.ts).
  const skillsDir = path.join(process.cwd(), 'skills');
  const skillPathBase = path.join(skillsDir, 'architect-planning.md');
  const skillPathThinking = path.join(skillsDir, 'architect-planning-thinking.md');
  const skillPathExecution = path.join(skillsDir, 'architect-planning-execution.md');
  const architectBaseSkill = fs.readFileSync(skillPathBase, 'utf-8');
  const architectThinkingSkill = fs.readFileSync(skillPathThinking, 'utf-8');
  const architectExecutionSkill = fs.readFileSync(skillPathExecution, 'utf-8');
  const exampleReport = fs.readFileSync(path.join(skillsDir, 'example-report.md'), 'utf-8');

  // 2 GENERATE CONTEXT STRING
  // We use the "Compressed Manifest" pattern: Metadata only, no 2000-token descriptions.
  const photoContext = imageList && imageList.length > 0 
    ? imageList.map((img, index) => {
        // Build a concise summary line (DB: description=user caption, ai_description=AI analysis)
        const tags = img.tags && img.tags.length > 0 ? `[Tags: ${img.tags.join(', ')}]` : '';
        const userDesc = img.userNote ? ` | User: "${img.userNote}"` : '';
        const aiDesc = img.aiDescription ? ` | AI: ${img.aiDescription.slice(0, 350)}${img.aiDescription.length > 350 ? '...' : ''}` : '';
        const severity = img.severity ? ` | Severity: ${img.severity}` : '';
        
        return `[ID: ${img.id}] Photo ${index + 1}: ${tags}${severity}${userDesc}${aiDesc}`;
      }).join('\n')
    : "No photos selected.";

  // Build the dynamic data string
  let dynamicInputs = `\n\n--- CURRENT TASK INPUTS ---\n`;
  dynamicInputs += `- Structure Requirements: ${structureInstructions}\n`;
  dynamicInputs += `- Photo Count: ${imageList?.length || 0}\n\n`;
  dynamicInputs += `AVAILABLE EVIDENCE:\n${photoContext}\n`;


  // Append user feedback if it exists
  if (userFeedback) {
    dynamicInputs += `\n!!! ATTENTION: PLAN REVISION !!!
    The user REJECTED your previous plan.
    USER FEEDBACK: "${userFeedback}"
    
    HERE IS YOUR PREVIOUS PLAN:
    \`\`\`json
    ${JSON.stringify(inputPlan, null, 2)}
    \`\`\`
    
    INSTRUCTIONS FOR REVISION:
    1. Keep the parts of the plan that work.
    2. ONLY change the sections mentioned in the feedback.
    3. Submit the FULL revised plan (all sections) again.`;
  }

  // 3. COMBINE AND CONSTRUCT PROMPT
  // Stick the static rules and the dynamic data together
  const promptContextPhase1 = `
  ${systemPrompt}\n
  ---
  EXAMPLE REPORT TO USE AS REFERENCE:
  ${exampleReport}\n
  --- 
  ${architectBaseSkill}\n
  
  ${architectThinkingSkill}\n

  ${dynamicInputs}`;

  // 4. RUN MODEL — 2-call architecture
  //
  // Phase 1 (non-streaming invoke, no tools): Full analysis in one REST response — avoids
  //   Gemini SSE/token-stream parse failures. Reasoning is then broadcast in chunked replay.
  //
  // Phase 2 (non-streaming, forced tool call): produce structured submitReportPlan JSON.

  const taskName = `Architect_Plan_1`;

  // ── Phase 1: Full reasoning via invoke, then chunked broadcast to UI ───────
  const phase1Model = ModelStrategy.getModel(provider || 'gemini', 'heavyweight', heliconeInput, false);
  const phase1Messages = [new SystemMessage(promptContextPhase1), ...state.messages];

  dumpAgentContext(taskName, phase1Messages, 'INPUT', reportTitle || "", undefined);

  const phase1Response = await ModelStrategy.invokeWithRetry(phase1Model, phase1Messages);
  let reasoningText = extractTextContent(phase1Response);
  await broadcastChunkedReasoning(state.projectId, reasoningText);

  // ── Phase 2: Structured plan (non-streaming, forced tool call) ─────────────
  // Embed the completed reasoning in the system prompt so the model can reference
  // it when structuring the plan, then force the tool call.
  const promptContextPhase2 = `
  ${systemPrompt}\n
  ---
  EXAMPLE REPORT TO USE AS REFERENCE:
  ${exampleReport}\n
  --- 
  ${architectBaseSkill}\n
  
  ${architectExecutionSkill}\n

  ${dynamicInputs}`;

  const phase2Prompt = `${promptContextPhase2}\n\n---\n**YOUR COMPLETED ANALYSIS:**\n${reasoningText}\n\nYou have finished your analysis. Now you MUST call \`submitReportPlan\` with the complete structured plan.`;

  const nonStreamingModel = ModelStrategy.getModel(provider || 'gemini', 'heavyweight', heliconeInput, false);
  const planModel = nonStreamingModel.bindTools!(planningTools(), { tool_choice: "submitReportPlan" });

  const response = await ModelStrategy.invokeWithRetry(planModel, [
    new SystemMessage(phase2Prompt),
    ...state.messages,
  ]);

  dumpAgentContext(taskName, [response], 'OUTPUT', reportTitle || "", undefined);

  // 5. PARSE TOOL CALL
  let reportPlan = null;
  let toolResultMsg = null;
  const aiMsg = response as AIMessage;
  
  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    const call = aiMsg.tool_calls[0];

    toolResultMsg = new ToolMessage({
      tool_call_id: call.id || '', 
      name: call.name,
      content: "Plan generated and saved successfully. Ready for approval."
    });

    if (call.name === 'submitReportPlan') {
      reportPlan = {
        sections: call.args.sections,
        strategy: call.args.strategy,
        user_questions: call.args.user_questions ?? [],
      };
    }
  }

  // 6. UPDATE DB (For UI Feedback)
  if (draftReportId && client) {
    try {
      await Container.reportService.updateReportStatus(draftReportId, {
        plan: reportPlan,          
        status: 'AWAITING_APPROVAL' 
      }, client);
      logger.info('✅ Architect: Report plan saved to database');
    } catch (error) {
      logger.error('❌ Architect: Failed to save report plan:', error);
    }
  }

  return {
    messages: toolResultMsg ? [response, toolResultMsg] : [response], 
    reportPlan,
    approvalStatus: 'PENDING',
    next_step: 'human_approval',
  };
}



 // 2. CONSTRUCT PROMPT
//   const promptContext = `${systemPrompt}

// ---
// ARCHITECT PHASE: PLANNING
// ---
// Your current role is to PLAN the report structure to get initial feedback from the user. You are NOT writing content yet.

// INPUTS:
// - Structure Requirements: ${structureInstructions} 
// - Photo Count: ${imageList?.length || 0}

// AVAILABLE EVIDENCE (Use these [ID: ...] UUIDs strictly):
// ${photoContext}

// ${userFeedback ? `!!! ATTENTION: PLAN REVISION !!!
//   The user REJECTED your previous plan.
//   USER FEEDBACK: "${userFeedback}"
  
//   HERE IS YOUR PREVIOUS PLAN (The one that was rejected):
//   \`\`\`json
//   ${JSON.stringify(inputPlan, null, 2)}
//   \`\`\`
  
//   INSTRUCTIONS FOR REVISION:
//   1. Keep the parts of the plan that work.
//   2. ONLY change the sections mentioned in the feedback.
//   3. Submit the FULL revised plan (all sections) again.
//   ` : ''} 

// YOUR TASK:
// 1. Analyze the evidence (Tags, Severity, User Notes).
// 2. Group related photos into logical high level sections (e.g., "Roofing", "Insulation").
// 3. Propose a logical structure using the 'submitReportPlan' tool.
// 4. Use the 'submitReportPlan' tool to output your plan in structured format.

// GUIDELINES:
// 1. **Execution Order (The Array):** You MUST output the 'sections' array in the order we should WRITE them.
//    - Start with Data/Observations (so we have facts).
//    - End with Summaries (so we can summarize the facts).

// 2. **Report Order (The Field):** For each section, assign the correct 'reportOrder' number for the Final PDF.
//    - Executive Summary should be 'reportOrder: 1'.
//    - Observations should be 'reportOrder: 2'.
//    - Recommendations should be 'reportOrder: 3'.

//    3. **Exclusive Photo Assignment:** - Photos must be assigned to the LOWEST possible level. 
//    - If a section has subsections, the assignedImageIds for the PARENT section MUST be an empty array [].
//    - Do not "duplicate" photo IDs in both the parent and the subsection. This causes repetitive content generation.

// Example Output:
// {
//     "reasoning": "...",
//     "sections": [
//       { 
//         "sectionId": "obs-roof", 
//         "title": "Roof Observations", 
//         "reportOrder": 2,
//         "purpose": "To document membrane deficiencies",
//         "assignedImageIds": [ "aa54020a-...","bb12345b-..."]
//       },
//       {
//         "sectionId": "exec-summary",
//         "title": "Executive Summary",
//         "reportOrder": 1,
//         "photoContext": []
//       }
//     ]
//   }

// `;