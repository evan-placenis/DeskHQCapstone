import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportTools } from "../../../tools/report.tools";
import { researchTools } from "../../../tools/research.tools"; // Keep research, drop vision
import { Container } from "@/backend/config/container";
import { ObservationState } from "../../../state/Pretium/ObservationState";
import { dumpAgentContext } from "../../../utils/agent-logger";
import * as fs from 'fs';
import * as path from 'path';

export async function builderNode(state: typeof ObservationState.State) {
  const { 
    reportPlan,
    imageList,
    currentSectionIndex, 
    draftReportId,
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
      text: `CURRENT TASK: ${currentTask.title}\nPURPOSE: ${currentTask.purpose}\nREPORT ID: ${draftReportId}\n\n` 
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

  // LOAD THE STATIC SKILL
  const skillPath = path.join(process.cwd(), 'skills', 'technical-observations.md');
  const technicalObservationSkill = fs.readFileSync(skillPath, 'utf-8');


  const combinedSystemPrompt = `
    
    ${systemPrompt}
    ---
    GLOBAL REPORT STRUCTURE (For Context Only):
    ${structureInstructions}
    
    Technical Observation Skills:
    ${technicalObservationSkill}
  `;

  const systemBlock = new SystemMessage(combinedSystemPrompt);

  // Assemble the isolated context window
  const promptMessages = buildTaskContext(messages, systemBlock, taskPrompt);



  // ==========================================
  // 4. Select Tools & Invoke Model
  // ==========================================
  const tools = [
    ...reportTools(freshClient), // Contains writeSection
    ...researchTools(projectId) // Keep research for building codes, etc.
  ];

  const baseModel = ModelStrategy.getModel(provider || 'gemini', 'lightweight', heliconeInput);
    if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const taskName = `Builder_Task_${currentSectionIndex + 1}`;
  dumpAgentContext(draftReportId || "", taskName, promptMessages, 'INPUT', isNewTask);

  const model = baseModel.bindTools(tools);
  const response= await model.invoke(promptMessages);
  dumpAgentContext(draftReportId || "", taskName, [response], 'OUTPUT');


  // ==========================================
  // 5. Save State
  // ==========================================
  const aiMsg = response as AIMessage;
  const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

// If new task: Anchor the new prompt and response into the global state
  // If resuming: Just append the new response
  const messagesToSave = isToolReturn 
    ? [response]                  // Just the answer
    : [taskPrompt, response];     // The Prompt + The Answer

  return {
    messages: messagesToSave, // In LangGraph, returning a list APPENDS to state
    next_step: hasToolCalls ? 'tools' : 'builder_continue'
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
      section.subsections.forEach((sub: any) => {
        tasks.push({
          type: 'subsection',
          id: sub.subSectionId,
          title: `${section.title}: ${sub.title}`,
          purpose: sub.purpose,
          // Extract IDs from the tuple structure
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

