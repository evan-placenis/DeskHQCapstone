import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportSkills } from "../../../../LangGraph_skills/report.skills";
import { researchSkills } from "../../../../LangGraph_skills/research.skills"; // Keep research, drop vision
import { Container } from "@/backend/config/container";
import { ObservationState } from "../../../state/report/ObservationState";


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
  } = state;
  // ✅ Get fresh client
  const freshClient = Container.adminClient;

  // 1. Safety Checks
  if (!reportPlan || !reportPlan.sections) {
    console.error('❌ Builder: No report plan found!');
    return { next_step: 'FINISH', messages: [] };
  }

  // 2. Identify Task
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];

  if (!currentTask) return { next_step: 'FINISH', messages: [] };
  console.log(`📝 Builder: Starting Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);

  // 3. 🖼️ PREPARE EVIDENCE (The Multimodal Magic)
  const contentParts: any[] = [];

  // A. Add Task Text
  let taskIntro = `CURRENT TASK: ${currentTask.title}\n`;
  taskIntro += `PURPOSE: ${currentTask.purpose}\n`;
  taskIntro += `REPORT ID: ${draftReportId}\n\n`;
  
  contentParts.push({ type: "text", text: taskIntro });

  // B. Resolve Photos for this Task
  // We look up the full ImageContext from state.imageList using the IDs assigned to this task.
  let activeImages: any[] = [];
  
  if (currentTask.photoIds && currentTask.photoIds.length > 0) {
    // Filter the global list to just the ones for this task
    activeImages = imageList.filter(img => currentTask.photoIds.includes(img.id));
    console.log(`📝 Builder: Found ${activeImages.length} images for task ${currentTask.title}`);
  } else if (!currentTask.photoIds) {
    // Fallback: If no specific photos assigned, maybe use all? (Or none)
    // For now, let's be safe and use none to avoid pollution, unless specifically requested.
    activeImages = [];
  }

  // C. Inject Images (Multimodal) OR Text Descriptions
  if (activeImages.length > 0) {
    // -------------------------------------------------------
    // MODE 1: TEXT ONLY (Fast, Cheap, No Base64)
    // -------------------------------------------------------
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
    } 
    
    // -------------------------------------------------------
    // MODE 2: IMAGE + TEXT (Full Multimodal)
    // -------------------------------------------------------
    else {
        console.log("📝 [Builder] Downloading Images for Multimodal Analysis...");
        contentParts.push({ type: "text", text: `--- VISUAL EVIDENCE (${activeImages.length} Photos) ---\nAnalyze these images directly to write the section.` });

        // ⚡ PARALLEL DOWNLOAD & CONVERSION
        const imageBlocks = await Promise.all(activeImages.map(async (img) => {
            const base64Data = await urlToBase64(img.url);
            if (!base64Data) return null; 

            return [
                { 
                    type: "text", 
                    text: `\n[Photo ID: ${img.id}] ${img.userNote || ''}` 
                },
                {
                    type: "image_url",
                    image_url: {
                        url: base64Data, 
                        detail: "high"
                    }
                }
            ];
        }));

        imageBlocks.forEach(block => {
            if (block) {
                contentParts.push(block[0]); 
                contentParts.push(block[1]); 
            }
        });
    }

  } else {
    contentParts.push({ type: "text", text: "No specific photos assigned to this section. Rely on general context or internal knowledge." });
  }

  // D. Add Instructions
  contentParts.push({ 
    type: "text", 
    text: `
    \n--- INSTRUCTIONS ---
    1. **ANALYZE:** Look at the visual evidence provided above.
    2. **SEARCH:** You may search for specifications in internal knowledge or helpful information on the web. If you have already called it, you should proceed to 'writeSection' to write about your findings if they are relevant.
       - **CRITICAL SEARCH RULE:** Do NOT include the Report ID (e.g., UUIDs) or words like "report" in your search query. Use only pure technical keywords (e.g., "EIFS window flashing details").
    3. **WRITE:** Write the section "${currentTask.title}", use the 'writeSection' tool to save your work.
      - **CRITICAL:** Every technical observation must site a spec if possible. Use the exact document name provided (e.g. "as per the Concrete_Specs_2024 document" or "per specification Concrete_Specs_2024").
    
    **CRITICAL:** When calling writeSection, you MUST use reportId: "${draftReportId}". Do not use any other ID.
    **ALLOWED TOOLS ONLY:** You have writeSection and research tools (e.g. searchInternalKnowledge for specifications). There is NO finishReport, submit_report, or completeReport tool. When the section is saved via writeSection, stop; the system will advance to the next task automatically.
    ` 
  });

  // 4. Construct System Message
  const combinedSystemPrompt = `
    ${systemPrompt || "You are an expert technical report builder."}
    ---
    STRICT FORMATTING PROTOCOLS:
    ${structureInstructions}
  `;
  // HISTORY HANDLING (THE FIX FOR LOOPING BACK TOOLS)
  const systemBlock = new SystemMessage(combinedSystemPrompt);
  const taskPrompt = new HumanMessage({ content: contentParts });

  // ---------------------------------------------------------
  // 🧹 CONTEXT HYGIENE & HISTORY HANDLING
  // ---------------------------------------------------------
  let promptMessages: BaseMessage[] = [];
  
  const lastMsg = messages[messages.length - 1];
  const isToolReturn = lastMsg instanceof ToolMessage;

  // 🔍 Check if we just started a NEW task
  // We can tell if it's a new task if the last HumanMessage in history 
  // does NOT match the current task's title.
  let isNewTask = true;
  for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg instanceof HumanMessage) {
        // TS-Safe Check: Convert complex arrays to a string to easily search them
        const contentString = typeof msg.content === 'string' 
            ? msg.content 
            : JSON.stringify(msg.content);
            
        // If the last prompt was about this exact task, we are in a research loop
        if (contentString.includes(`CURRENT TASK: ${currentTask.title}`)) {
            isNewTask = false;
        }
        break; // Stop at the most recent HumanMessage
      }
  }

  if (isToolReturn && !isNewTask) {
    // 🔄 RESEARCH LOOP: We are returning from a search FOR THIS TASK.
    // Scan backwards until we find the HumanMessage that started THIS task.
    const relevantHistory: BaseMessage[] = [];
    
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      relevantHistory.unshift(msg);
      if (msg instanceof HumanMessage) break; // Found the start!
    }

    // Reconstruct: [System] + [History of this task (which includes the taskPrompt)]
    promptMessages = [systemBlock, ...relevantHistory];
    
  } else {
    // 🆕 FRESH START: We are starting a new task (or resuming from approval).
    // Ignore history, just send the new prompt.
    promptMessages = [systemBlock, taskPrompt];
  }

  // 5. Select Tools (Only 'writeSection' and 'research' needed now)
  // We removed visionSkills because the vision is now native!
  const tools = [
    ...reportSkills(freshClient), // Contains writeSection
    ...researchSkills(projectId) // Keep research for building codes, etc.
  ];

  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
    if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const model = baseModel.bindTools(tools);

  // 6. Invoke Model
  // We send [System, Human(Multimodal)]
  const response = await model.invoke(promptMessages);

  const aiMsg = response as AIMessage;
  const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

  // 📝 LOGIC FIX:
  // IF it's a Tool Return (Resume): 
  //    We just append the AI's new response to the existing history.
  // IF it's a Fresh Start (New Task): 
  //    We must append the 'HumanMessage' (The Task) AND the 'AIMessage' (The Response).
  //    This creates a "Boundary" in the history that we can find later.

  const messagesToSave = isToolReturn 
    ? [response]                  // Just the answer
    : [taskPrompt, response];     // The Prompt + The Answer

  return {
    messages: messagesToSave, // In LangGraph, returning a list APPENDS to state
    next_step: hasToolCalls ? 'tools' : 'builder_continue'
  };
}

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

    return { 
        builderRetries: retryCount + 1, 
        messages: [feedbackMessage], 
        next_step: 'builder' 
    };
  }
}

// export async function builderContinueNode(state: typeof ObservationState.State) {
//   const { 
//     reportPlan, 
//     currentSectionIndex, 
//     messages, 
//     sectionDrafts, // ✅ FROM YOUR CODE
//     draftReportId, 
//     builderRetries 
//   } = state;

//   const freshClient = Container.adminClient;

//   // 1. Identify Task
//   if (!reportPlan || !reportPlan.sections) return { next_step: 'FINISH' };
  
//   const tasks = getFlattenedTasks(reportPlan.sections);
//   const currentTask = tasks[currentSectionIndex];

//   // If done or out of bounds, go to Reviewer
//   if (!currentTask) return { next_step: 'reviewer' };

//   console.log(`🔍 [BuilderContinue] Analyzing result for Task ${currentSectionIndex + 1}: "${currentTask.title}"...`);

//   let success = false;
//   let newDraftContent = "";

//   // ---------------------------------------------------------
//   // 2. CHECK FOR TOOL SUCCESS (The Happy Path)
//   // ---------------------------------------------------------
//   for (let i = messages.length - 1; i >= 0; i--) {
//     const msg = messages[i];
//     // 🛡️ BREAK ON TASK BOUNDARY
//     // If we hit the HumanMessage that started THIS task, and haven't found a success yet, stop.
//     // This prevents us from "accidentally" finding a success from a previous section.
//     if (msg instanceof HumanMessage) break;

//     // ⚠️ SKIP: If the message is an AI response, stop checking.
//     if (msg instanceof AIMessage) break; // Stop at the AI's last turn

//     if (msg instanceof ToolMessage && msg.name === 'writeSection') {
//       try {
//         const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;

//         // ✅ VERIFY THIS SUCCESS IS FOR THE CURRENT TASK
//         // Compare the sectionId in the tool output to our current task's ID
//         const isCurrentTask = content.sectionId === currentTask.id;
        
//         // Check for success flags
//         if (isCurrentTask && (content.status === 'SUCCESS' || content._written === true)) {
//           success = true;
//           newDraftContent = content.preview || content.content || "Section saved via tool.";
//           console.log(`✅ [BuilderContinue] Verified Tool Save.`);
//           break; 
//         }
//       } catch (e) { 
//           console.warn("⚠️ Tool output parsing failed", e); 
//       }
//     }
//   }

//   // ---------------------------------------------------------
//   // 3. CHECK FOR TEXT FALLBACK (The "AI Forgot" Path)
//   // ---------------------------------------------------------
//   if (!success) {
//     const lastMsg = messages[messages.length - 1];

//     // If the AI just wrote text...
//     if (lastMsg instanceof AIMessage && !lastMsg.tool_calls?.length) {
//        const text = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
       
//        if (text.length > 50) {
//          console.log(`⚠️ [BuilderContinue] AI wrote raw text. Saving as fallback...`);
//          newDraftContent = text;

//          // 💾 MANUAL SAVE (Because the tool didn't run)
//          try {
//            await Container.reportService.updateSectionInReport(
//              draftReportId || "",
//              currentTask.id,
//              currentTask.title,
//              text,
//              currentTask.reportOrder || 2, 
//              freshClient
//            );
//            success = true;
//            console.log("💾 Fallback Saved to DB.");
//          } catch (err) {
//            console.error("❌ Fallback save failed:", err);
//          }
//        }
//     }
//   }

//   // ---------------------------------------------------------
//   // 4. ROUTING LOGIC & STATE UPDATES
//   // ---------------------------------------------------------
//   if (success) {
//     // ✅ SUCCESS: Update Drafts & Increment Index
//     const nextIndex = currentSectionIndex + 1;
//     const isFinished = nextIndex >= tasks.length; 

//     // 🔄 STATE UPDATE (Restored from your code)
//     // We must update 'sectionDrafts' so the Synthesis Node can read it later!
//     const updatedDrafts = { 
//         ...sectionDrafts, 
//         [currentTask.title]: newDraftContent 
//     };

//     console.log(`🚀 [BuilderContinue] Task Complete. Moving to Index ${nextIndex}`);

//     return {
//       sectionDrafts: updatedDrafts,   // <--- RESTORED THIS
//       currentSectionIndex: nextIndex, 
//       builderRetries: 0,              
//       next_step: isFinished ? 'reviewer' : 'builder' 
//     };
//   } 
  
//   else {
//     // 🛑 FAILURE: Retry
//     const retryCount = builderRetries || 0;
    
//     if (retryCount >= 2) {
//       console.error(`❌ [BuilderContinue] Failed task "${currentTask.title}" 3 times. Skipping.`);
//       return {
//         currentSectionIndex: currentSectionIndex + 1, // Give up, move next
//         builderRetries: 0,
//         next_step: 'builder'
//       };
//     }

//     console.log(`🔄 [BuilderContinue] Task failed. Retrying (Attempt ${retryCount + 1})...`);
    
//     // System Scolding
//     const feedbackMessage = new HumanMessage({
//       content: `SYSTEM ERROR: You did not save the section. 
//       You MUST call the "writeSection" tool with reportId: "${draftReportId}".`
//     });
//     return { 
//         builderRetries: retryCount + 1, 
//         messages: [feedbackMessage], 
//         next_step: 'builder' 
//     };
    
//   }
  
// }


// import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
// import { ModelStrategy } from "../../../models/modelStrategy";
// import { reportSkills } from "../../../../LangGraph_skills/report.skills";
// import { visionSkillsWithReport } from "../../../../LangGraph_skills/vision.skills";
// import { researchSkills } from "../../../../LangGraph_skills/research.skills";
// import { Container } from "@/backend/config/container";
// // 🛠️ HELPER: Turn the nested tree into a flat list of tasks
// function getFlattenedTasks(sections: any[]) {
//   const tasks: any[] = [];
  
//   sections.forEach(section => {
//     // 1. If it has subsections, the subsections become the tasks
//     if (section.subsections && section.subsections.length > 0) {
//       section.subsections.forEach((sub: any) => {
//         tasks.push({
//           type: 'subsection',
//           id: sub.subSectionId, // Use the subsection ID
//           title: `${section.title}: ${sub.title}`, // Clear context (e.g. "Observations: Walls")
//           purpose: sub.purpose,
//           // Source of truth: photoContext tuples → derive photoIds from them
//           photoContext: sub.photoContext || [],
//           photoIds: (sub.photoContext || []).map((p: any) => p.photoId),
//           parentId: section.sectionId
//         });
//       });
//     } 
//     // 2. If it's a regular section (like Recommendations), it is a task
//     else {
//       tasks.push({
//         type: 'main',
//         id: section.sectionId,
//         title: section.title,
//         purpose: section.purpose,
//         // Source of truth: photoContext tuples → derive photoIds from them
//         photoContext: section.photoContext || [],
//         photoIds: (section.photoContext || []).map((p: any) => p.photoId),
//       });
//     }
//   });
  
//   return tasks;
// }

// // Helper to identify if the last message was a Builder Research tool
// function lastMessageIsResearchTool(msg: BaseMessage | undefined): boolean {
//   if (!msg) return false;
//   if (!(msg instanceof ToolMessage)) return false;
  
//   // Ignore Writing tools
//   if (msg.name === 'writeSection') return false;
  
//   // Ignore Architect tools (CRITICAL FIX for pollution)
//   if (msg.name === 'submitReportPlan') return false;
  
//   return true; // It's a research/vision tool
// }

// export async function builderNode(state: any) {
//   const { 
//     reportPlan,
//     sectionDrafts,
//     researchFindings,
//     photoNotes,
//     currentSectionIndex, // This now tracks the TASK index, not the section index
//     draftReportId,
//     provider,
//     projectId,
//     userId,
//     client,
//     selectedImageIds,
//     messages, // <--- The heavy "Snowball" history
//     builderRetries,
//     processingMode,       // 'TEXT_ONLY' | 'IMAGE_AND_TEXT' from NewReportModal
//     systemPrompt,         // "John's Spiel" (Liability)
//     structureInstructions // "The Blueprint" (Formatting/Tables)
//   } = state;

//   // 1. 🛡️ Safety Checks
//   if (!reportPlan || !reportPlan.sections) {
//     console.error('❌ Builder: No report plan found!');
//     return { next_step: 'FINISH', messages: [] };
//   }

//   // 2. ⚡ FLATTEN THE PLAN
//   // This turns your 3 main sections into ~5 specific tasks
//   const tasks = getFlattenedTasks(reportPlan.sections);
//   const currentTask = tasks[currentSectionIndex];

//   if (!currentTask) return { next_step: 'FINISH', messages: [] };
//   console.log(`📝 Builder: Starting Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);

//   // 3. Check for Completion
//   if (currentSectionIndex >= tasks.length) {
//     console.log('✅ Builder: All tasks complete. Report finished.');
//     return { next_step: 'FINISH', messages: [] };
//   }


//   // 4. Build Context (Simpler now!)
//   // We only show the photos for THIS specific task
//   let taskContext = `CURRENT TASK: ${currentTask.title}\n`;
//   taskContext += `REPORT ID: ${draftReportId}\n`;
//   taskContext += `PURPOSE: ${currentTask.purpose}\n`;
//   // taskContext += `ASSIGNED PHOTOS: ${currentTask.photoIds.length > 0 ? currentTask.photoIds.join(', ') : 'None (Use general knowledge or previous context)'}\n`;
  
//   // Check if the Architect provided the new "photoContext" tuples
//   if (currentTask.photoContext && currentTask.photoContext.length > 0) {
//     taskContext += `\n--- ASSIGNED EVIDENCE ---\n`;
    
//     currentTask.photoContext.forEach((item: any) => {
//         taskContext += `[Photo ID: ${item.photoId}]\n`;
//         if (item.note) taskContext += `   ↳ User Note: "${item.note}"\n`;
//     });
    
//     // Also inject the IDs list for the "Cheat Sheet"
//     const ids = currentTask.photoContext.map((p: any) => p.photoId).join(', ');
//     taskContext += `\nAVAILABLE PHOTO UUIDS: ${ids}\n`;

//   } else {
//       // ⚠️ FALLBACK: The Architect was lazy or older plan format
//       // Use the logic we wrote before (Global IDs + Global Notes)
//       taskContext += `STRATEGY: No specific context assigned. Using global pool.\n`;
//       taskContext += `AVAILABLE PHOTO UUIDS: ${selectedImageIds.join(', ')}\n`;
      
//       if (photoNotes) {
//         taskContext += `GLOBAL NOTES: "${photoNotes}"\n`;
//       }
//   }
  
//   // // Context of previous work (make this a skill instead of hardcoding it)
//   // const previousSectionsContext = Object.entries(sectionDrafts || {})
//   //   .map(([id, content]) => `## Previously Written (${id}):\n${content}`)
//   //   .join('\n\n---\n\n');

//   // 5. Bind Tools — include vision skills only when user chose "Image & Text" (exclude for "Text Only")
//   const includeVision = processingMode !== 'TEXT_ONLY';
//   const tools = [
//     ...reportSkills(projectId, userId, client, selectedImageIds),
//     ...(includeVision ? visionSkillsWithReport(draftReportId, client) : []),
//     ...researchSkills(projectId)
//   ];
//   // 2. Generate a "Cheat Sheet" string programmatically
//   // This creates a string like: "write_report_section, analyze_batch_images, ..."
//   // const availableToolNames = tools.map(t => t.name).join(", ");

//   const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
//   if (typeof baseModel.bindTools !== 'function') {
//     throw new Error("Model does not support tools");
//  }
//   const model = baseModel.bindTools(tools);

//   // ---------------------------------------------------------
//   // 6. 🧹 CONTEXT HYGIENE (The Critical Fix)
//   // ---------------------------------------------------------

//   // A. MERGE SYSTEM MESSAGES (Fixes "System message should be first" error)
//   // Gemini expects exactly ONE SystemMessage at the very top.
//   const combinedSystemPrompt = `
//     ${systemPrompt || "You are an expert technical report builder."}

//     ---
//     STRICT FORMATTING PROTOCOLS:
//     ${structureInstructions}
//   `;

//   const systemBlock = new SystemMessage(combinedSystemPrompt);


//   // C. The "Job Order" (Specific Task)
//   const taskBlock = new HumanMessage(`
//     ${taskContext}

//     INSTRUCTIONS:
//     1. **ANALYZE PHOTOS:** Analyze the assigned photos (if any) using 'getProjectImageURLsWithIDS'.
//     2. **CHECK SPECS:** If you do not know the specific material requirements or installation standards for this section, use the 'searchInternalKnowledge' tool FIRST.
//     - *Example:* "Search for roofing membrane installation requirements."
//     3. **WRITE:** Generate the section "${currentTask.title}" strictly following the formatting protocols.
//   `);

//   // D. Construct the Message History
//   let promptMessages: BaseMessage[] = [];

//   // 🔍 CHECK: Did we just come from a research tool?
//   // ✅ FIX: Explicitly ignore 'submitReportPlan' so we don't think the Architect's work is our research.
//   const lastMsg = messages[messages.length - 1];
//   const justFetchedData = lastMessageIsResearchTool(lastMsg);

//   if (builderRetries === 0 && !justFetchedData) {
//     // ✅ FRESH START: Ignore global history!
//     // This removes the Architect's noise and ensures strict formatting adherence.
//     promptMessages = [systemBlock, taskBlock];
//   } else {
//     // ⚠️ RESEARCH LOOP or RETRY: Include ALL research context from this task
//     // Without this, the AI forgets it already fetched images / searched specs
//     // and loops back to re-research the same things indefinitely.
//     const taskHistory: BaseMessage[] = [];
//     for (let i = messages.length - 1; i >= 0; i--) {
//       const msg = messages[i];
//       // Stop at architect/approval boundaries — everything before is a different phase
//       if (msg instanceof ToolMessage && msg.name === 'submitReportPlan') break;
//       if (msg instanceof HumanMessage) break;
//       taskHistory.unshift(msg);
//     }

//     // 🛡️ SANITIZE for Anthropic: every tool_result must follow an assistant tool_use.
//     // If the scan picked up orphaned ToolMessages (from a previous task or checkpoint
//     // resume), drop them so the API doesn't reject the request.
//     while (taskHistory.length > 0 && taskHistory[0] instanceof ToolMessage) {
//       taskHistory.shift();
//     }

//     // If nothing valid survived, fall back to a clean fresh start
//     if (taskHistory.length === 0) {
//       promptMessages = [systemBlock, taskBlock];
//     } else {
//       promptMessages = [systemBlock, taskBlock, ...taskHistory];
//     }
//   }

//   // 7. Invoke Model
//   const response = await model.invoke(promptMessages);

//   const aiMsg = response as AIMessage;
//   const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

// //  // We "grab" only the specific slice of state needed right now.
// // const specificSlice = JSON.stringify(reportPlan.sections[currentSectionIndex]);

//   // const response = await model.invoke([
//   //   new SystemMessage(systemPrompt + `\nDETAILS: ${specificSlice}`),
//   //   ...messages
//   // ]);

//   return {
//     messages: [response],
//     next_step: hasToolCalls ? 'tools' : 'builder_continue'
//   };
// }
// export async function builderContinueNode(state: any) {
//   const { reportPlan, currentSectionIndex, messages, builderRetries, projectId, userId, client , researchFindings} = state;
  
//   const tasks = getFlattenedTasks(reportPlan.sections);
//   const currentTask = tasks[currentSectionIndex];

//   if (!currentTask) return { next_step: 'FINISH' };


//   const lastMsg = messages[messages.length - 1];

//   // 1. 🔍 Check if the LAST step was a "Research Tool" (e.g., getImages)
//   // If the AI just called 'getProjectImages', we shouldn't punish it. 
//   // We should send it back to the Builder to use that new info.
//   if (lastMsg instanceof ToolMessage && lastMsg.name !== 'writeSection') {
//       console.log(`🔄 Builder used research tool (${lastMsg.name}). looping back to write.`);
//       // We return to 'builder' but we DO NOT increment retries.
//       // We allow the builder to see this ToolMessage in the next turn (handled by retry logic or custom logic).

//       // 💡 NEW: Save the finding to the Shared Notebook!
//       // This way, the NEXT section (e.g. Conclusion) can see it without searching again.
//       let newFinding = `\n[Source: ${lastMsg.name}]: ${lastMsg.content.slice(0, 200)}...`;
//       return { 
//           next_step: 'builder',
//           builderRetries: builderRetries, // Keep retry count same
//           researchFindings: (researchFindings || "") + newFinding //add to this shared memory but might not actually need this 
//       };
//   }

//   let success = false;
//   let newDraftContent = "";

//   // ---------------------------------------------------------
//   // 1. Check for TOOL Success (The "Best" Path)
//   // ---------------------------------------------------------
//   for (let i = messages.length - 1; i >= 0; i--) {
//     const msg = messages[i];
//     // 🔍 CLEANER LOG: See exactly what message we are checking
//     console.log(`🔍 [Msg ${i}] Type: ${msg._getType()} | Name: ${msg.name}`);
//     if (msg._getType() === 'ai') break; // Stop at the last thought

//     if (msg.name === 'writeSection' || (msg instanceof ToolMessage && msg.name === 'writeSection')) {
//       try {
//         const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
//         if (content._written === true || content.status === 'SUCCESS') {
//           success = true;
//           newDraftContent = content.preview || "Section saved via tool.";
//           console.log(`✅ Verified Tool Save: "${currentTask.title}"`);
//           break; 
//         }
//       } catch (e) { console.warn("⚠️ Tool JSON parse error", e); }
//     }
//   }

//   // ---------------------------------------------------------
//   // 2. Check for TEXT Fallback (The "AI Wrote It Anyway" Path)
//   // ---------------------------------------------------------
//   if (!success) {
//     const lastMsg = messages[messages.length - 1];

//     if (lastMsg instanceof AIMessage && lastMsg.content) {
//        const text = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
       
//        // Heuristic: If it wrote a reasonable amount of text (e.g. > 50 chars), accept it.
//        if (text.length > 50) {
//          console.log(`⚠️ Tool failed, but AI wrote text. Saving as fallback.`);
//          success = true;
//          newDraftContent = text;

//          // 💾 CRITICAL: Since the tool didn't run, WE must save it to DB now.
//          try {
//            await Container.reportService.updateSectionInReport(
//              state.draftReportId, // Ensure this is in your state!
//              currentTask.id,
//              currentTask.title,
//              newDraftContent,
//              currentSectionIndex,
//              client || Container.adminClient // Use client from state
//            );
//            console.log("💾 Fallback Saved to DB successfully.");
//          } catch (err) {
//            console.error("❌ Failed to save fallback text to DB:", err);
//          }
//        }
//     }
//   }

//   // ---------------------------------------------------------
//   // 3. Move Logic
//   // ---------------------------------------------------------
//   if (success) {
//     const nextIndex = currentSectionIndex + 1;
//     const isFinished = nextIndex >= tasks.length; 

//     return {
//       sectionDrafts: { [currentTask.id]: newDraftContent },
//       currentSectionIndex: nextIndex,
//       builderRetries: 0,
//       next_step: isFinished ? 'FINISH' : 'builder'
//     };
//   } else {
//     // Retry Logic (Same as before)
//     const retryCount = builderRetries || 0;
//     if (retryCount >= 3) {
//       console.error(`❌ Failed task "${currentTask.title}" 3 times. Skipping.`);
//       return {
//         currentSectionIndex: currentSectionIndex + 1,
//         builderRetries: 0,
//         next_step: 'builder'
//       };
//     }
//     const feedbackMessage = new HumanMessage({
//       content: `SYSTEM ALERT: You did not call the "writeSection" tool. 
//       You only replied with text. 
//       STOP chatting. 
//       IMMEDIATELY call the "writeSection" tool with the Report ID: "${state.draftReportId}".`
//     });
//     return { builderRetries: retryCount + 1, messages: [feedbackMessage], next_step: 'builder' };
//   }
// }