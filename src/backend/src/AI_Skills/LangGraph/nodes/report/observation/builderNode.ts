import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportTools } from "../../../tools/report.tools";
import { researchTools } from "../../../tools/research.tools"; // Keep research, drop vision
import { Container } from "@/backend/config/container";
import { ObservationState } from "../../../state/Pretium/ObservationState";
import { dumpAgentContext } from "../../../utils/agent-logger";
import * as fs from 'fs';
import * as path from 'path';

// 🛠️ HELPER: Flatten sections into tasks
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
  // ✅ Get fresh client
  const freshClient = Container.adminClient;

  // 1. Safety Checks & Identify Task
  if (!reportPlan || !reportPlan.sections) {
    console.error('❌ Builder: No report plan found!');
    return { next_step: 'FINISH', messages: [] };
  }
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];
  if (!currentTask) return { next_step: 'FINISH', messages: [] };
  console.log(`📝 Builder: Starting Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);

  // 2. DETERMINE TASK STATE FIRST
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  let isToolReturn = lastMsg && (lastMsg.type === 'tool' || lastMsg._getType?.() === 'tool');

  // 🚨 TERMINAL TOOL CHECK: 
  // If the last tool was 'writeSection', we finished the previous task!
  // The upcoming run is a brand new task.
  if (isToolReturn && lastMsg?.name === 'writeSection') {
      isToolReturn = false; 
  }

  const isNewTask = !isToolReturn;
  let taskPrompt: BaseMessage;

 // ==========================================
  // 3. 🖼️ PREPARE EVIDENCE (Only if NEW task)
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
    if (activeImages.length > 0) {
      if (processingMode === 'TEXT_ONLY') {
        console.log("📝 [Builder] Using Text Summaries (Skipping Image Download)");
        
        let evidenceBlock = `--- VISUAL EVIDENCE SUMMARIES (${activeImages.length} Photos) ---\n`;
        evidenceBlock += `The following images document the conditions. Use these descriptions to write the section.\n\n`;
        
        activeImages.forEach(img => {
            const description = img.aiDescription || "No detailed analysis available.";
            const note = img.userNote ? `User Note: "${img.userNote}"` : "";
            const tags = img.tags ? `Tags: [${img.tags.join(', ')}]` : "";

            evidenceBlock += `[Photo ID: ${img.id}]\n`;
            evidenceBlock += `   ${note}\n`;
            evidenceBlock += `   AI Analysis: ${description}\n`;
            evidenceBlock += `   ${tags}\n\n`;
        });

        contentParts.push({ type: "text", text: evidenceBlock });
      } else {
        console.log("📝 [Builder] Downloading Images for Multimodal Analysis...");
        contentParts.push({ type: "text", text: `--- VISUAL EVIDENCE (${activeImages.length} Photos) ---\nAnalyze these images directly to write the section.` });

        const imageBlocks = await Promise.all(activeImages.map(async (img) => {
          const base64Data = await urlToBase64(img.url);
          if (!base64Data) return null; 
          return [
            { type: "text", text: `\n[Photo ID: ${img.id}] ${img.userNote || ''}` },
            { type: "image_url", image_url: { url: base64Data, detail: "high" } }
          ];
        }));

        imageBlocks.forEach(block => {
          if (block) { contentParts.push(block[0]); contentParts.push(block[1]); }
        });
      }
    } else {
      contentParts.push({ type: "text", text: "No specific photos assigned to this section. Rely on general context or internal knowledge." });
    }
    taskPrompt = new HumanMessage({ content: contentParts });
  } else {
    // ==========================================
    // 🚀 THE HANG FIX: RESUMING A TASK
    // ==========================================
    console.log(`🔄 Builder: Resuming Task ${currentSectionIndex + 1} (Skipping Image Downloads)`);
    
    // The images are already downloaded and stored in the global history array!
    // We just find the last HumanMessage and reuse it.
    const lastHumanMsg = [...messages].reverse().find(m => m.type === 'human' || m._getType?.() === 'human');
    
    if (!lastHumanMsg) throw new Error("Critical: Lost the HumanMessage task prompt in state!");
    taskPrompt = lastHumanMsg as BaseMessage;
  }

  // ==========================================
  // 4. Construct System Message & Context
  // ==========================================

  // LOAD THE STATIC SKILL
  const skillPath = path.join(process.cwd(), 'skills', 'technical-writer.md');
  const technicalWriterSkill = fs.readFileSync(skillPath, 'utf-8');


  const combinedSystemPrompt = `
    
    ${systemPrompt}
    ---
    GLOBAL REPORT STRUCTURE (For Context Only):
    ${structureInstructions}
    
    Technical Writer Skills:
    ${technicalWriterSkill}
  `;

  const systemBlock = new SystemMessage(combinedSystemPrompt);

  // Assemble the isolated context window
  const promptMessages = buildTaskContext(messages, systemBlock, taskPrompt);



  // ==========================================
  // 5. Select Tools & Invoke Model
  // ==========================================
  const tools = [
    ...reportTools(freshClient), // Contains writeSection
    ...researchTools(projectId) // Keep research for building codes, etc.
  ];

  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap', heliconeInput);
    if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const taskName = `Builder_Task_${currentSectionIndex + 1}`;
  dumpAgentContext(draftReportId || "", taskName, promptMessages, 'INPUT', isNewTask);

  const model = baseModel.bindTools(tools);
  const response= await model.invoke(promptMessages);
  dumpAgentContext(draftReportId || "", taskName, [response], 'OUTPUT');


  // ==========================================
  // 6. Save State
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















export async function builderContinueNode(state: any) {
  const { 
    reportPlan, 
    currentSectionIndex, 
    messages, 
    sectionDrafts, 
    draftReportId, 
    builderRetries 
  } = state;

  const freshClient = Container.adminClient;

  // 1. Identify Task
  if (!reportPlan || !reportPlan.sections) return { next_step: 'FINISH' };
  
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];

  // If done or out of bounds, go to Reviewer
  if (!currentTask) return { next_step: 'reviewer' };

  console.log(`🔍 [BuilderContinue] Analyzing result for Task ${currentSectionIndex + 1}: "${currentTask.title}"...`);
  // 📝 INJECT LOGGER 1: What did the tools just return?
  const taskName = `BuilderContinue_Task_${currentSectionIndex + 1}`;
  dumpAgentContext(draftReportId, taskName, messages, 'INPUT');

  let success = false;
  let newDraftContent = "";

   // We need to find the index of the LAST Human Message (which started this current turn)
   let lastHumanMsgIndex = -1;
   for (let i = messages.length - 1; i >= 0; i--) {
       if (messages[i] instanceof HumanMessage) {
           lastHumanMsgIndex = i;
           break;
       }
   }

  // ---------------------------------------------------------
  // 2. CHECK FOR RESEARCH (The "Learning" Path) - NEW! 🧠
  // ---------------------------------------------------------
  // If the AI just performed a search, we aren't "done", but we didn't "fail".
  // We need to loop back to the Builder so it can read the search results.


  // ONLY look at messages that happened after that prompt.
  // This completely prevents Task 1's actions from bleeding into Task 2.
  const currentTurnMessages = messages.slice(lastHumanMsgIndex + 1);
  const isResearchLoop = currentTurnMessages.some((m: any) => 
    m instanceof ToolMessage && 
    (m.name === 'searchInternalKnowledge' || m.name === 'searchWeb')
  );

  if (isResearchLoop) {
    // Check if we *also* wrote a section in this turn (rare but possible)
    const wroteSomething = currentTurnMessages.some((m: any) => m.name === 'writeSection');
    if (!wroteSomething) {
      console.log(`🧠 [BuilderContinue] Research detected. Returning to Builder to process findings.`);
      return { 
        next_step: 'builder',
        builderRetries: 0 // Reset retries so research doesn't count against us
      };
    }
  }

  // ---------------------------------------------------------
  // 3. CHECK FOR TOOL SUCCESS (The "Lenient" Path) - UPDATED! ✅
  // ---------------------------------------------------------
 
  // Only look for tool outputs that happened AFTER the last Human Message
  const recentToolOutputs = currentTurnMessages
    .filter((m: any) => m instanceof ToolMessage && m.name === 'writeSection');

  for (const msg of recentToolOutputs) {
    try {
      const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;

      // ✅ LENIENT CHECK: Just look for SUCCESS flag
      // We do NOT strictly compare sectionId === currentTask.id anymore.
      // If the AI successfully wrote *any* section, we treat the task as progressed.
      if (content.status === 'SUCCESS' || content._written === true) {
        success = true;
        // Capture the preview or content for the Synthesis node
        newDraftContent = content.preview || content.content || "Section saved.";
        
        console.log(`✅ [BuilderContinue] Verified Tool Save (ID: ${content.sectionId}).`);
        break; // Found our success!
      }
    } catch (e) {
      console.warn("⚠️ Tool output parsing failed", e);
    }
  }

  // ---------------------------------------------------------
  // 4. CHECK FOR TEXT FALLBACK (The "AI Forgot" Path)
  // ---------------------------------------------------------
  if (!success) {
    
    const lastMsg = messages[messages.length - 1];

    // Only run fallback if it's an AI text message with NO tool calls
    if (lastMsg instanceof AIMessage && !lastMsg.tool_calls?.length) {
       const text = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
       
       // Heuristic: If it wrote a decent amount of text, assume it tried to write the report
       if (text.length > 50) {
         console.log(`⚠️ [BuilderContinue] AI wrote raw text instead of using tool. Saving as fallback...`);
         newDraftContent = text;

         const safeOrder = Math.floor(Number(currentTask.reportOrder));

         // 💾 MANUAL SAVE
         try {
           await Container.reportService.updateSectionInReport(
             draftReportId || "",
             currentTask.id,
             currentTask.title,
             text,
             currentTask.safeOrder, 
             freshClient
           );
           success = true;
           console.log("💾 Fallback Saved to DB.");
         } catch (err) {
           console.error("❌ Fallback save failed:", err);
         }
       }
    }
  }

  // ---------------------------------------------------------
  // 5. ROUTING LOGIC
  // ---------------------------------------------------------
  if (success) {
    // ✅ SUCCESS: Update Drafts & Increment Index
    const nextIndex = currentSectionIndex + 1;
    const isFinished = nextIndex >= tasks.length; 

    // Update 'sectionDrafts' for Synthesis Node
    const updatedDrafts = { 
        ...sectionDrafts, 
        [currentTask.title]: newDraftContent 
    };

    console.log(`🚀 [BuilderContinue] Task Complete. Moving to Index ${nextIndex}`);

    return {
      sectionDrafts: updatedDrafts, 
      currentSectionIndex: nextIndex, 
      builderRetries: 0,              
      next_step: isFinished ? 'reviewer' : 'builder' 
    };
  } 
  
  else {
    // 🛑 FAILURE: Retry
    const retryCount = builderRetries || 0;
    
    if (retryCount >= 2) {
      console.error(`❌ [BuilderContinue] Failed task "${currentTask.title}" 3 times. Skipping.`);
      return {
        currentSectionIndex: currentSectionIndex + 1, // Skip task
        builderRetries: 0,
        next_step: 'builder'
      };
    }

    console.log(`🔄 [BuilderContinue] Task failed. Retrying (Attempt ${retryCount + 1})...`);
    
    const feedbackMessage = new HumanMessage({
      content: `SYSTEM ERROR: Section not saved. 
      You MUST call the "writeSection" tool with reportId: "${draftReportId}".`
    });
    // 📝 INJECT LOGGER 2: Log the feedback we are about to send back to the AI
    dumpAgentContext(draftReportId, taskName, [feedbackMessage], 'OUTPUT');

    return { 
        builderRetries: retryCount + 1, 
        messages: [feedbackMessage], 
        next_step: 'builder' 
    };
  }
}