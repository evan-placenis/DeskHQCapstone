import { SystemMessage, AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { reportSkills } from "../../../../LangGraph_skills/report.skills";
import { visionSkills } from "../../../../LangGraph_skills/vision.skills";
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
          photoIds: sub.assignedPhotoIds || [],
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
        photoIds: section.assignedPhotoIds || []
      });
    }
  });
  
  return tasks;
}

export async function builderNode(state: any) {
  const { 
    reportPlan,
    sectionDrafts,
    currentSectionIndex, // This now tracks the TASK index, not the section index
    draftReportId,
    provider,
    projectId,
    userId,
    client,
    selectedImageIds,
    messages // <--- The heavy "Snowball" history
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
  let structureContext = `CURRENT TASK: ${currentTask.title}\n`;
  structureContext += `REPORT ID: ${draftReportId}\n`;
  structureContext += `PURPOSE: ${currentTask.purpose}\n`;
  structureContext += `ASSIGNED PHOTOS: ${currentTask.photoIds.length > 0 ? currentTask.photoIds.join(', ') : 'None (Use general knowledge or previous context)'}\n`;

  // // Context of previous work
  // const previousSectionsContext = Object.entries(sectionDrafts || {})
  //   .map(([id, content]) => `## Previously Written (${id}):\n${content}`)
  //   .join('\n\n---\n\n');



  // 5. Bind Tools (Same as before)
  const tools = [
    ...reportSkills(projectId, userId, client, selectedImageIds),
    ...visionSkills
  ];
  // 2. Generate a "Cheat Sheet" string programmatically
  // This creates a string like: "write_report_section, analyze_batch_images, ..."
  const availableToolNames = tools.map(t => t.name).join(", ");

  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
  if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const model = baseModel.bindTools(tools);



  const systemPrompt = `
  You are an expert technical report builder.
  Your goal is to write the section: "${currentTask.title}"
  
  CONTEXT:
  ${structureContext}

  PROTOCOL (Follow strictly):
    1. **THOUGHT**: First, think about what you need to do. You can output this as text.
      - If you need to see photos, say "I need to analyze the photos."
      - If you are ready to write, say "I am writing the section now."
      - You MUST use the Report ID provided above: "${draftReportId}"

    2. **ACTION**: Call the correct tool.
      - To see photos: use 'getProjectImageURLsWithIDS' -> 'analyze_batch_images'
      - To save your writing: use 'write_report_section' (This is mandatory!)

    ⚠️ CRITICAL:
    You must eventually call 'writeSection' to save your work. 
    Writing text in the chat is NOT enough.
  [ ${availableToolNames} ]
  `;



 // We "grab" only the specific slice of state needed right now.
const specificSlice = JSON.stringify(reportPlan.sections[currentSectionIndex]);

  const response = await model.invoke([
    new SystemMessage(systemPrompt + `\nDETAILS: ${specificSlice}`),
    ...messages
  ]);

  const aiMsg = response as AIMessage;
  const hasToolCalls = aiMsg.tool_calls && aiMsg.tool_calls.length > 0;

  return {
    messages: [response],
    next_step: hasToolCalls ? 'tools' : 'builder_continue'
  };
}
export async function builderContinueNode(state: any) {
  const { reportPlan, currentSectionIndex, messages, builderRetries, projectId, userId, client } = state;
  
  const tasks = getFlattenedTasks(reportPlan.sections);
  const currentTask = tasks[currentSectionIndex];

  if (!currentTask) return { next_step: 'FINISH' };

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