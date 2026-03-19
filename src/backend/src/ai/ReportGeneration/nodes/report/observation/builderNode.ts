import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportTools } from "../../../tools/report.tools";
import { researchTools } from "../../../tools/research.tools";
import { Container } from "@/backend/config/container";
import { ObservationState } from "../../../state/Pretium/ObservationState";
import { dumpAgentContext } from "../../../utils/agent-logger";
import { extractTextContent } from "../../../utils/streaming-adapter";
import { createNodeBroadcaster } from "../../../utils/node-broadcast";
import * as fs from 'fs';
import * as path from 'path';

export async function builderNode(state: typeof ObservationState.State) {
  const { 
    reportPlan,
    userClarification,
    imageList,
    currentSectionIndex, 
    draftReportId,
    reportTitle,
    provider,
    projectId,
    userId,
    selectedImageIds,     // Fallback only
    processingMode,       // 'TEXT_ONLY' | 'IMAGE_AND_TEXT'
    systemPrompt,       
    structureInstructions,
    messages,
    heliconeInput,
  } = state;
  // Safety Checks & Identify Task
  if (!reportPlan || !reportPlan.sections) {
    console.error('❌ Builder: No report plan found!');
    return { next_step: 'FINISH', messages: [] };
  }
  const freshClient = Container.adminClient;

  // ==========================================
  // 1.Analyze the task and determine if it is a new task or a resumed task
  // ==========================================
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];
  if (!currentTask) return { next_step: 'FINISH', messages: [] };
  console.log(`📝 Builder: Starting Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);

  // DETERMINE TASK STATE FIRST
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  let isToolReturn = lastMsg && (lastMsg.type === 'tool' || lastMsg._getType?.() === 'tool');

  // TERMINAL TOOL CHECK: If the last tool was 'writeSection', we finished the previous task!
  if (isToolReturn && lastMsg?.name === 'writeSection') {
      isToolReturn = false; 
  }

  const isNewTask = !isToolReturn;
  let taskPrompt: BaseMessage;

  // ==========================================
  // 2. a) PREPARE EVIDENCE (Only if NEW task)
  // ==========================================
  if (isNewTask) {
    console.log(`📝 Builder: Starting NEW Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);
    const contentParts: any[] = [];

    // A. Add Task Text
    contentParts.push({ 
      type: "text", 
      text: `CURRENT TASK: ${currentTask.title}\nPURPOSE: ${currentTask.purpose}\nREPORT ID: ${draftReportId}\nSECTION ORDER: ${currentTask.reportOrder ?? 0}\n\n` 
    });

    // B. Resolve Photos
    let activeImages: any[] = [];
    if (currentTask.photoIds && currentTask.photoIds.length > 0) {
      activeImages = imageList.filter(img => currentTask.photoIds.includes(img.id));
    }

    // C. Inject Images
    const imageEvidenceParts = await buildImageEvidenceContent(activeImages, processingMode);
    contentParts.push(...imageEvidenceParts);
    taskPrompt = new HumanMessage({ content: contentParts });
  } else {
    // ==========================================
    // 2. b) RESUMING EXISTING TASK AFTER A TOOL CALL
    // ==========================================
    console.log(`🔄 Builder: Resuming Task ${currentSectionIndex + 1} (Skipping Image Downloads)`);
    
    // The images are already downloaded and stored in the global history array! We just find the last HumanMessage and reuse it.
    const lastHumanMsg = [...messages].reverse().find(m => m.type === 'human' || m._getType?.() === 'human');
    
    if (!lastHumanMsg) throw new Error("Critical: Lost the HumanMessage task prompt in state!");
    taskPrompt = lastHumanMsg as BaseMessage;
  }

  // ==========================================
  // 3. CONSTRUCT SYSTEM MESSAGE & CONTEXT
  // ==========================================

  // LOAD THE STATIC SKILL (Trigger.dev cwd=capstone/src/backend)
  const skillPathBase = path.join(process.cwd(), 'src/AI_Skills/ReportGeneration/skills/technical-observations.md');
  const skillPathThinking = path.join(process.cwd(), 'src/AI_Skills/ReportGeneration/skills/technical-observations(thinking).md');
  const skillPathExecution = path.join(process.cwd(), 'src/AI_Skills/ReportGeneration/skills/technical-observations(execution).md');
  const technicalObservationBaseSkill = fs.readFileSync(skillPathBase, 'utf-8');
  const technicalObservationThinkingSkill = fs.readFileSync(skillPathThinking, 'utf-8');
  const technicalObservationExecutionSkill = fs.readFileSync(skillPathExecution, 'utf-8');
  const exampleReport = fs.readFileSync(path.join(process.cwd(), 'src/AI_Skills/ReportGeneration/skills/example-report.md'), 'utf-8');

  // Build Q&A pairs from architect's questions + user answers (index-matched)
  const questions = reportPlan.user_questions ?? [];
  const answers = userClarification ?? [];
  const clarificationBlock = questions.length > 0
    ? questions.map((q, i) => `Q: ${q}\nA: ${answers[i] ?? 'No answer provided'}`).join('\n\n')
    : 'No additional user clarifications provided.';

  const combinedSystemPromptPhase1 = `
    
    ${systemPrompt}
    ---
    GLOBAL REPORT STRUCTURE (For Context Only):
    ${structureInstructions}
    ---
    EXAMPLE REPORT TO USE AS REFERENCE:
    ${exampleReport}
    ---
    Technical Observation Skills:
    ${technicalObservationBaseSkill}
    ---
    ${technicalObservationThinkingSkill}

    USER CLARIFICATIONS & VERIFIED FACTS (Question-Answer Pairs):
    ${clarificationBlock}
    ---

  `;

  // Phase 1 system block — used only for the streaming reasoning call on new tasks
  const systemBlockPhase1 = new SystemMessage(combinedSystemPromptPhase1);

  // buildTaskContext is only used on mid-task resumes (after a research tool result).
  // For new tasks it must NOT be used: the previous task's writeSection ToolMessage
  // still sits at the tail of state.messages, and buildTaskContext would walk back
  // and include that task's evidence and AI response, giving the model wrong context.
  const promptMessages = isNewTask
    ? [systemBlockPhase1, taskPrompt]
    : buildTaskContext(messages, systemBlockPhase1, taskPrompt);



  // ==========================================
  // 4. Select Tools & Build Model Instances
  // ==========================================
  const tools = [
    ...reportTools(freshClient),
    ...researchTools(projectId),
  ];

  const taskName = `Builder_Task_${currentSectionIndex + 1}`;

  // ──────────────────────────────────────────────────────────────────────────
  // 2-call architecture
  //
  // Phase 1 (streaming, no tools) — only on NEW tasks:
  //   The model writes its analytical chain of thought as plain text first.
  //   Tokens are broadcast to the frontend in real-time.
  //   No tools are bound, so Gemini only emits text chunks → no parse errors.
  //
  // Phase 2 (non-streaming, with tools):
  //   A streaming=false model instance calls the actual tools (writeSection,
  //   research). Non-streaming means the Google SDK uses the REST endpoint and
  //   returns a complete JSON response, completely bypassing the SSE parser.
  // ──────────────────────────────────────────────────────────────────────────

  let reasoningText = '';

  if (isNewTask) {
    // ── Phase 1: Stream chain-of-thought reasoning ──────────────────────────
    const streamingModel = ModelStrategy.getModel(provider || 'gemini', 'lightweight', heliconeInput, true);
    const broadcaster = createNodeBroadcaster(projectId);

    dumpAgentContext(taskName, promptMessages, 'INPUT', reportTitle || '', isNewTask);

    // Phase 1 uses promptMessages which was built with systemBlockPhase1
    const reasoningStream = await streamingModel.stream(promptMessages);
    for await (const chunk of reasoningStream) {
      const text = extractTextContent(chunk);
      if (text) {
        reasoningText += text;
        await broadcaster.push(text);
      }
    }
    await broadcaster.flush();

    // Persist Phase 1 reasoning to log file for post-run inspection
    if (reasoningText) {
      try {
        const safeTitle = (reportTitle || 'untitled').replace(/[^a-z0-9-]/gi, '_');
        const logsDir = path.join(process.cwd(), '.logs', `Report_${safeTitle}`);
        const reasoningDir = path.join(logsDir, 'reasoning');
        await fs.promises.mkdir(reasoningDir, { recursive: true });
        const entry =
          `====================================================\n` +
          `NODE: ${taskName} | PHASE: 1 (streaming reasoning)\n` +
          `TIME: ${new Date().toLocaleString()}\n` +
          `====================================================\n` +
          `${reasoningText}\n\n\n`;
        await fs.promises.appendFile(path.join(reasoningDir, 'all_reasoning.txt'), entry);
      } catch (logErr) {
        console.warn('[Builder] Could not write Phase 1 reasoning log:', logErr);
      }
    }
  }

  // ── Phase 2: Tool execution (non-streaming) ────────────────────────────────
  // Embed the completed reasoning into the system prompt for Phase 2 so the
  // model can reference its own analysis when deciding which tool to call.

  const combinedSystemPromptPhase2 = `
    
  ${systemPrompt}
  ---
  GLOBAL REPORT STRUCTURE (For Context Only):
  ${structureInstructions}
  ---
  EXAMPLE REPORT TO USE AS REFERENCE:
  ${exampleReport}
  ---
  Technical Observation Skills:
  ${technicalObservationBaseSkill}
  ---
  ${technicalObservationExecutionSkill}

  USER CLARIFICATIONS & VERIFIED FACTS (Question-Answer Pairs):
  ${clarificationBlock}
  ---
  `;

  // Phase 2 always uses the execution system block.
  // On a new task: inject the Phase 1 reasoning so the model knows what it decided.
  // On resume:     rebuild the context window with the execution block (not Phase 1's
  //                thinking block) so the model receives the correct instructions
  //                when continuing after a tool result.
  const phase2SystemContent = isNewTask && reasoningText
    ? `${combinedSystemPromptPhase2}\n\n---\n**YOUR COMPLETED ANALYSIS:**\n${reasoningText}\n\nYou have finished your analysis. Now execute it: call the appropriate tool (research or writeSection).`
    : combinedSystemPromptPhase2;

  const systemBlockPhase2 = new SystemMessage(phase2SystemContent);

  // New tasks always get a clean [system, taskPrompt] context — no prior task history.
  // buildTaskContext is only used on resume (after a mid-task research tool result)
  // because state.messages may still have the PREVIOUS task's writeSection ToolMessage
  // at its tail, which would cause buildTaskContext to walk back and inject the wrong
  // task's evidence and sectionId into the current task's context.
  const phase2Messages = isNewTask
    ? [systemBlockPhase2, taskPrompt]
    : buildTaskContext(messages, systemBlockPhase2, taskPrompt);

  const nonStreamingModel = ModelStrategy.getModel(provider || 'gemini', 'lightweight', heliconeInput, false);
  if (typeof nonStreamingModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
  }
  const model = nonStreamingModel.bindTools(tools);

  const response = await model.invoke(phase2Messages);
  dumpAgentContext(taskName, [response], 'OUTPUT', reportTitle || '', undefined);

  // ==========================================
  // 5. Save State
  // ==========================================
  const aiMsg = response as AIMessage;
  const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

  // New task: save taskPrompt + response (reasoning was broadcast-only, not stored in state)
  // Resume:   save only the new response
  const messagesToSave = isToolReturn
    ? [response]
    : [taskPrompt, response];

  return {
    messages: messagesToSave,
    next_step: hasToolCalls ? 'tools' : 'builder_continue',
  };
}



// HELPER: Flatten sections into tasks
export function getFlattenedTasks(sections: any[]) {
  // 1. SORT BY REPORT ORDER
  // We must ensure they are in 1, 2, 3... order before we pop anything.
  const sortedSections = [...sections].sort((a, b) => a.reportOrder - b.reportOrder);
  // 2. IDENTIFY BOOKENDS (Head & Tail)
  // We assume the first and last sections are always "Synthesis" tasks 
  // that the Builder should skip.
  if (sortedSections.length >= 3) {
    // Remove the first and last element
    sortedSections.shift(); // Remove Head
    sortedSections.pop();   // Remove Tail
  } 
  else if (sortedSections.length === 2) {
      // Edge Case: If only 2 sections (e.g. Intro + Obs), just skip Intro
      // For safety, let's just skip the first one (Summary).
      sortedSections.shift();
  }
  
  const tasks: any[] = [];
  sortedSections.forEach(section => {
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((sub: any, subIdx: number) => {
        // Use integer order: parent's reportOrder * 100 + subIndex + 1
        // e.g. parent order 3 → subsections get 301, 302 ...
        const subOrder = Math.floor(Number(section.reportOrder)) * 100 + subIdx + 1;
        tasks.push({
          type: 'subsection',
          id: sub.subSectionId,
          title: `${section.title}: ${sub.title}`,
          purpose: sub.purpose,
          reportOrder: subOrder,
          photoIds: (sub.photoContext || []).map((p: any) => p.photoId),
          parentId: section.sectionId
        });
      });
    } else {
      tasks.push({
        type: 'main',
        id: section.sectionId,
        title: section.title,
        purpose: section.purpose,
        reportOrder: section.reportOrder,
        photoIds: (section.photoContext || []).map((p: any) => p.photoId),
      });
    }
  });
  return tasks;
}

// 🛠️ HELPER: Build content parts for image evidence (text summaries or base64 images)
async function buildImageEvidenceContent(
  activeImages: any[],
  processingMode: string
): Promise<any[]> {
  if (activeImages.length === 0) {
    return [{ type: "text", text: "No specific photos assigned to this section. Rely on general context or internal knowledge." }];
  }

  if (processingMode === 'TEXT_ONLY') {
    console.log("📝 [Builder] Using Text Summaries (Skipping Image Download)");
    let evidenceBlock = `--- VISUAL EVIDENCE SUMMARIES (${activeImages.length} Photos) ---\n The following images document the conditions. Use these descriptions to write the section.\n\n`;
    activeImages.forEach(img => {
      const description = img.aiDescription || "No detailed analysis available.";
      const note = img.userNote ? `User Note: "${img.userNote}"` : "";
      const tags = img.tags ? `Tags: [${img.tags.join(', ')}]` : "";
      evidenceBlock += `[Photo ID: ${img.id}]\n`;
      evidenceBlock += `   ${note}\n`;
      evidenceBlock += `   AI Analysis: ${description}\n`;
      evidenceBlock += `   ${tags}\n\n`;
    });
    return [{ type: "text", text: evidenceBlock }];
  }

  console.log("📝 [Builder] Downloading Images for Multimodal Analysis...");
  const parts: any[] = [
    { type: "text", text: `--- VISUAL EVIDENCE (${activeImages.length} Photos) ---\nAnalyze these images directly to write the section.` }
  ];
  const imageBlocks = await Promise.all(activeImages.map(async (img) => {
    const base64Data = await urlToBase64(img.url);
    if (!base64Data) return null;
    return [
      { type: "text", text: `\n[Photo ID: ${img.id}] ${img.userNote || ''}` },
      { type: "image_url", image_url: { url: base64Data, detail: "high" } }
    ];
  }));
  imageBlocks.forEach(block => {
    if (block) { parts.push(block[0]); parts.push(block[1]); }
  });
  return parts;
}

// 🛠️ HELPER: Fetch URL and convert to Base64
async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');
    const mimeType = response.headers.get('content-type') || 'image/jpeg';
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    console.error("❌ Failed to convert image to base64:", error);
    return ""; // Return empty string on failure to prevent crash
  }
}

export function buildTaskContext(
  messages: BaseMessage[], 
  systemBlock: BaseMessage, 
  taskPrompt: BaseMessage
): BaseMessage[]{
  
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  const isHumanMsg = (m: any) => m instanceof HumanMessage || m.type === 'human' || m._getType?.() === 'human';
  const isToolMsg = (m: any) => m instanceof ToolMessage || m.type === 'tool' || m._getType?.() === 'tool';

  const isToolReturn = isToolMsg(lastMsg);
  if (isToolReturn) {
    // 🔄 RESEARCH LOOP: Gather recent AI/Tool back-and-forth
    const relevantHistory: BaseMessage[] = [];
    
    // Walk backward to grab the AI's tool calls and the Tool results
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      
      // Stop going backward as soon as we hit ANY human message.
      // This isolates the memory to strictly the recent tool attempts.
      if (isHumanMsg(msg)) break; 
      
      relevantHistory.unshift(msg);
    }
    
    // Assemble the perfect context: 
    // System Rules -> Current Task Prompt -> Recent Tool Attempts
    return [systemBlock, taskPrompt, ...relevantHistory];
  }

  // 🆕 FRESH START: No trailing tool messages found
  return [systemBlock, taskPrompt];
}



  //   // D. Add Instructions
  //   contentParts.push({  
  //     type: "text", 
  //     text: `
  //     \n--- INSTRUCTIONS ---
  //     1. **ANALYZE:** Look at the visual evidence provided above.
  //     2. **SEARCH STRATEGY & CIRCUIT BREAKER:** - You will likely need to research multiple distinct topics for this section (e.g., historical weather via Web Search, AND technical specifications via Internal Database).
  //         - **The Limit:** You are strictly limited to a maximum of TWO (2) search attempts PER SPECIFIC ITEM. 
  //         - **The Fallback:** If you cannot find a specific piece of data (like the weather, crew size, or a specific spec reference) after 2 targeted searches, you MUST abandon that specific search. Immediately insert the exact **[MISSING: <Data Type>]** placeholder for that missing item, and move on to researching your next requirement.
  //     3. **WRITE:** Write the section "${currentTask.title}", use the 'writeSection' tool to save your work.
  //     - **CRITICAL:** Every technical observation must site a spec if possible. Use the exact document name provided (e.g. "as per the Concrete_Specs_2024 document" or "per specification Concrete_Specs_2024").
      
  //     **Note:** When calling writeSection, you MUST use reportId: "${draftReportId}". Do not use any other ID.
  //     "CRITICAL LIABILITY RULE: You must NEVER invent, assume, or hallucinate deficiencies. If the provided photos only show compliant work, your Deficiency Summary must explicitly state that no defects were observed. Do not fabricate issues just to populate sections."
  //     **ALLOWED TOOLS ONLY:** You have writeSection and research tools (e.g. searchInternalKnowledge for specifications). There is NO finishReport, submit_report, or completeReport tool. When the section is saved via writeSection, stop; the system will advance to the next task automatically.
  //     ` 
  //   });
  // const combinedSystemPrompt = `
  //   ${systemPrompt}
  //   ---
  //   GLOBAL REPORT STRUCTURE (For Context Only):
  //   ${structureInstructions}

  //   CRITICAL INSTRUCTION
  //   You are currently executing ONLY this specific task: "${currentTask.title}".
  //   DO NOT generate the entire report. DO NOT output any sections other than the one assigned to you. 
    
  //   EXAMPLE INTERACTION:
  //   <thinking>
  //   I need to write the Site/Staging Area section. No photos were provided, so I will search the internal knowledge base for weather and crew details.
  //   </thinking>
  //   [AI natively invokes tool (e.g searchInternalKnowledge or writeSection)]

  // `;

