import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportSkills } from "../../../../LangGraph_skills/report.skills";
import { visionSkills } from "../../../../LangGraph_skills/vision.skills";
import { researchSkills } from "../../../../LangGraph_skills/research.skills";
import { Container } from "@/backend/config/container";
// 🛠️ HELPER: Turn the nested tree into a flat list of tasks
function getFlattenedTasks(sections: any[]) {
  const tasks: any[] = [];
  
  sections.forEach(section => {
    // 1. If it has subsections, the subsections become the tasks
    if (section.subsections && section.subsections.length > 0) {
      section.subsections.forEach((sub: any) => {
        tasks.push({
          type: 'subsection',
          id: sub.subSectionId, // Use the subsection ID
          title: `${section.title}: ${sub.title}`, // Clear context (e.g. "Observations: Walls")
          purpose: sub.purpose,
          // Source of truth: photoContext tuples → derive photoIds from them
          photoContext: sub.photoContext || [],
          photoIds: (sub.photoContext || []).map((p: any) => p.photoId),
          parentId: section.sectionId
        });
      });
    } 
    // 2. If it's a regular section (like Recommendations), it is a task
    else {
      tasks.push({
        type: 'main',
        id: section.sectionId,
        title: section.title,
        purpose: section.purpose,
        // Source of truth: photoContext tuples → derive photoIds from them
        photoContext: section.photoContext || [],
        photoIds: (section.photoContext || []).map((p: any) => p.photoId),
      });
    }
  });
  
  return tasks;
}

// Helper to identify if the last message was a Builder Research tool
function lastMessageIsResearchTool(msg: BaseMessage | undefined): boolean {
  if (!msg) return false;
  if (!(msg instanceof ToolMessage)) return false;
  
  // Ignore Writing tools
  if (msg.name === 'writeSection') return false;
  
  // Ignore Architect tools (CRITICAL FIX for pollution)
  if (msg.name === 'submitReportPlan') return false;
  
  return true; // It's a research/vision tool
}

export async function builderNode(state: any) {
  const { 
    reportPlan,
    sectionDrafts,
    researchFindings,
    photoNotes,
    currentSectionIndex, // This now tracks the TASK index, not the section index
    draftReportId,
    provider,
    projectId,
    userId,
    client,
    selectedImageIds,
    messages, // <--- The heavy "Snowball" history
    builderRetries,

    systemPrompt,          // "John's Spiel" (Liability)
    structureInstructions  // "The Blueprint" (Formatting/Tables)
  } = state;

  // 1. 🛡️ Safety Checks
  if (!reportPlan || !reportPlan.sections) {
    console.error('❌ Builder: No report plan found!');
    return { next_step: 'FINISH', messages: [] };
  }

  // 2. ⚡ FLATTEN THE PLAN
  // This turns your 3 main sections into ~5 specific tasks
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];

  if (!currentTask) return { next_step: 'FINISH', messages: [] };
  console.log(`📝 Builder: Starting Task ${currentSectionIndex + 1}/${tasks.length}: ${currentTask.title}`);

  // 3. Check for Completion
  if (currentSectionIndex >= tasks.length) {
    console.log('✅ Builder: All tasks complete. Report finished.');
    return { next_step: 'FINISH', messages: [] };
  }


  // 4. Build Context (Simpler now!)
  // We only show the photos for THIS specific task
  let taskContext = `CURRENT TASK: ${currentTask.title}\n`;
  taskContext += `REPORT ID: ${draftReportId}\n`;
  taskContext += `PURPOSE: ${currentTask.purpose}\n`;
  // taskContext += `ASSIGNED PHOTOS: ${currentTask.photoIds.length > 0 ? currentTask.photoIds.join(', ') : 'None (Use general knowledge or previous context)'}\n`;
  
  // Check if the Architect provided the new "photoContext" tuples
  if (currentTask.photoContext && currentTask.photoContext.length > 0) {
    taskContext += `\n--- ASSIGNED EVIDENCE ---\n`;
    
    currentTask.photoContext.forEach((item: any) => {
        taskContext += `[Photo ID: ${item.photoId}]\n`;
        if (item.note) taskContext += `   ↳ User Note: "${item.note}"\n`;
    });
    
    // Also inject the IDs list for the "Cheat Sheet"
    const ids = currentTask.photoContext.map((p: any) => p.photoId).join(', ');
    taskContext += `\nAVAILABLE PHOTO UUIDS: ${ids}\n`;

  } else {
      // ⚠️ FALLBACK: The Architect was lazy or older plan format
      // Use the logic we wrote before (Global IDs + Global Notes)
      taskContext += `STRATEGY: No specific context assigned. Using global pool.\n`;
      taskContext += `AVAILABLE PHOTO UUIDS: ${selectedImageIds.join(', ')}\n`;
      
      if (photoNotes) {
        taskContext += `GLOBAL NOTES: "${photoNotes}"\n`;
      }
  }
  
  // // Context of previous work (make this a skill instead of hardcoding it)
  // const previousSectionsContext = Object.entries(sectionDrafts || {})
  //   .map(([id, content]) => `## Previously Written (${id}):\n${content}`)
  //   .join('\n\n---\n\n');

  // 5. Bind Tools (Same as before)
  const tools = [
    ...reportSkills(projectId, userId, client, selectedImageIds),
    ...visionSkills,
    ...researchSkills(projectId)
  ];
  // 2. Generate a "Cheat Sheet" string programmatically
  // This creates a string like: "write_report_section, analyze_batch_images, ..."
  // const availableToolNames = tools.map(t => t.name).join(", ");

  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
  if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const model = baseModel.bindTools(tools);

  // ---------------------------------------------------------
  // 6. 🧹 CONTEXT HYGIENE (The Critical Fix)
  // ---------------------------------------------------------

  // A. MERGE SYSTEM MESSAGES (Fixes "System message should be first" error)
  // Gemini expects exactly ONE SystemMessage at the very top.
  const combinedSystemPrompt = `
    ${systemPrompt || "You are an expert technical report builder."}

    ---
    STRICT FORMATTING PROTOCOLS:
    ${structureInstructions}
  `;

  const systemBlock = new SystemMessage(combinedSystemPrompt);


  // C. The "Job Order" (Specific Task)
  const taskBlock = new HumanMessage(`
    ${taskContext}

    INSTRUCTIONS:
    1. **ANALYZE PHOTOS:** Analyze the assigned photos (if any) using 'getProjectImageURLsWithIDS'.
    2. **CHECK SPECS:** If you do not know the specific material requirements or installation standards for this section, use the 'searchInternalKnowledge' tool FIRST.
    - *Example:* "Search for roofing membrane installation requirements."
    3. **WRITE:** Generate the section "${currentTask.title}" strictly following the formatting protocols.
  `);

  // D. Construct the Message History
  let promptMessages: BaseMessage[] = [];

  // 🔍 CHECK: Did we just come from a research tool?
  // ✅ FIX: Explicitly ignore 'submitReportPlan' so we don't think the Architect's work is our research.
  const lastMsg = messages[messages.length - 1];
  const justFetchedData = lastMessageIsResearchTool(lastMsg);

  if (builderRetries === 0 && !justFetchedData) {
    // ✅ FRESH START: Ignore global history!
    // This removes the Architect's noise and ensures strict formatting adherence.
    promptMessages = [systemBlock, taskBlock];
  } else {
    // ⚠️ RESEARCH LOOP or RETRY: Include ALL research context from this task
    // Without this, the AI forgets it already fetched images / searched specs
    // and loops back to re-research the same things indefinitely.
    const taskHistory: BaseMessage[] = [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      // Stop at architect/approval boundaries — everything before is a different phase
      if (msg instanceof ToolMessage && msg.name === 'submitReportPlan') break;
      if (msg instanceof HumanMessage) break;
      taskHistory.unshift(msg);
    }

    // 🛡️ SANITIZE for Anthropic: every tool_result must follow an assistant tool_use.
    // If the scan picked up orphaned ToolMessages (from a previous task or checkpoint
    // resume), drop them so the API doesn't reject the request.
    while (taskHistory.length > 0 && taskHistory[0] instanceof ToolMessage) {
      taskHistory.shift();
    }

    // If nothing valid survived, fall back to a clean fresh start
    if (taskHistory.length === 0) {
      promptMessages = [systemBlock, taskBlock];
    } else {
      promptMessages = [systemBlock, taskBlock, ...taskHistory];
    }
  }

  // 7. Invoke Model
  const response = await model.invoke(promptMessages);

  const aiMsg = response as AIMessage;
  const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

//  // We "grab" only the specific slice of state needed right now.
// const specificSlice = JSON.stringify(reportPlan.sections[currentSectionIndex]);

  // const response = await model.invoke([
  //   new SystemMessage(systemPrompt + `\nDETAILS: ${specificSlice}`),
  //   ...messages
  // ]);

  return {
    messages: [response],
    next_step: hasToolCalls ? 'tools' : 'builder_continue'
  };
}
export async function builderContinueNode(state: any) {
  const { reportPlan, currentSectionIndex, messages, builderRetries, projectId, userId, client , researchFindings} = state;
  
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];

  if (!currentTask) return { next_step: 'FINISH' };


  const lastMsg = messages[messages.length - 1];

  // 1. 🔍 Check if the LAST step was a "Research Tool" (e.g., getImages)
  // If the AI just called 'getProjectImages', we shouldn't punish it. 
  // We should send it back to the Builder to use that new info.
  if (lastMsg instanceof ToolMessage && lastMsg.name !== 'writeSection') {
      console.log(`🔄 Builder used research tool (${lastMsg.name}). looping back to write.`);
      // We return to 'builder' but we DO NOT increment retries.
      // We allow the builder to see this ToolMessage in the next turn (handled by retry logic or custom logic).

      // 💡 NEW: Save the finding to the Shared Notebook!
      // This way, the NEXT section (e.g. Conclusion) can see it without searching again.
      let newFinding = `\n[Source: ${lastMsg.name}]: ${lastMsg.content.slice(0, 200)}...`;
      return { 
          next_step: 'builder',
          builderRetries: builderRetries, // Keep retry count same
          researchFindings: (researchFindings || "") + newFinding //add to this shared memory but might not actually need this 
      };
  }

  let success = false;
  let newDraftContent = "";

  // ---------------------------------------------------------
  // 1. Check for TOOL Success (The "Best" Path)
  // ---------------------------------------------------------
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    // 🔍 CLEANER LOG: See exactly what message we are checking
    console.log(`🔍 [Msg ${i}] Type: ${msg._getType()} | Name: ${msg.name}`);
    if (msg._getType() === 'ai') break; // Stop at the last thought

    if (msg.name === 'writeSection' || (msg instanceof ToolMessage && msg.name === 'writeSection')) {
      try {
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
        if (content._written === true || content.status === 'SUCCESS') {
          success = true;
          newDraftContent = content.preview || "Section saved via tool.";
          console.log(`✅ Verified Tool Save: "${currentTask.title}"`);
          break; 
        }
      } catch (e) { console.warn("⚠️ Tool JSON parse error", e); }
    }
  }

  // ---------------------------------------------------------
  // 2. Check for TEXT Fallback (The "AI Wrote It Anyway" Path)
  // ---------------------------------------------------------
  if (!success) {
    const lastMsg = messages[messages.length - 1];

    if (lastMsg instanceof AIMessage && lastMsg.content) {
       const text = typeof lastMsg.content === 'string' ? lastMsg.content : JSON.stringify(lastMsg.content);
       
       // Heuristic: If it wrote a reasonable amount of text (e.g. > 50 chars), accept it.
       if (text.length > 50) {
         console.log(`⚠️ Tool failed, but AI wrote text. Saving as fallback.`);
         success = true;
         newDraftContent = text;

         // 💾 CRITICAL: Since the tool didn't run, WE must save it to DB now.
         try {
           await Container.reportService.updateSectionInReport(
             state.draftReportId, // Ensure this is in your state!
             currentTask.id,
             currentTask.title,
             newDraftContent,
             currentSectionIndex,
             client || Container.adminClient // Use client from state
           );
           console.log("💾 Fallback Saved to DB successfully.");
         } catch (err) {
           console.error("❌ Failed to save fallback text to DB:", err);
         }
       }
    }
  }

  // ---------------------------------------------------------
  // 3. Move Logic
  // ---------------------------------------------------------
  if (success) {
    const nextIndex = currentSectionIndex + 1;
    const isFinished = nextIndex >= tasks.length; 

    return {
      sectionDrafts: { [currentTask.id]: newDraftContent },
      currentSectionIndex: nextIndex,
      builderRetries: 0,
      next_step: isFinished ? 'FINISH' : 'builder'
    };
  } else {
    // Retry Logic (Same as before)
    const retryCount = builderRetries || 0;
    if (retryCount >= 3) {
      console.error(`❌ Failed task "${currentTask.title}" 3 times. Skipping.`);
      return {
        currentSectionIndex: currentSectionIndex + 1,
        builderRetries: 0,
        next_step: 'builder'
      };
    }
    const feedbackMessage = new HumanMessage({
      content: `SYSTEM ALERT: You did not call the "writeSection" tool. 
      You only replied with text. 
      STOP chatting. 
      IMMEDIATELY call the "writeSection" tool with the Report ID: "${state.draftReportId}".`
    });
    return { builderRetries: retryCount + 1, messages: [feedbackMessage], next_step: 'builder' };
  }
}