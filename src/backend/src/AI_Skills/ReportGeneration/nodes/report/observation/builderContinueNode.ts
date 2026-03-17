import { AIMessage, ToolMessage, HumanMessage, BaseMessage } from "@langchain/core/messages";
import { Container } from "@/backend/config/container";
import { dumpAgentContext } from "../../../utils/agent-logger";
import { getFlattenedTasks } from "./builderNode";

export async function builderContinueNode(state: any) {
    const { 
      reportPlan, 
      currentSectionIndex, 
      messages, 
      sectionDrafts, 
      draftReportId, 
      reportTitle,
      builderRetries 
    } = state;
    if (!reportPlan || !reportPlan.sections) return { next_step: 'FINISH' };
    const freshClient = Container.adminClient;
  
    // Identify Task
    const tasks = getFlattenedTasks(reportPlan.sections);
    const currentTask = tasks[currentSectionIndex];
  
    // If done or out of bounds, go to Reviewer
    if (!currentTask) return { next_step: 'reviewer' };
  
    console.log(`🔍 [BuilderContinue] Analyzing result for Task ${currentSectionIndex + 1}: "${currentTask.title}"...`);
    const taskName = `BuilderContinue_Task_${currentSectionIndex + 1}`;
    dumpAgentContext(draftReportId, taskName, messages, 'INPUT', undefined, reportTitle);
  
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
    // 2. CHECK FOR RESEARCH (The "Learning" Path)
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
    // 3. CHECK FOR TOOL SUCCESS (The "Lenient" Path)
    // ---------------------------------------------------------
   
    // Only look for tool outputs that happened AFTER the last Human Message
    const recentToolOutputs = currentTurnMessages
      .filter((m: any) => m instanceof ToolMessage && m.name === 'writeSection');
  
    for (const msg of recentToolOutputs) {
      try {
        const content = typeof msg.content === 'string' ? JSON.parse(msg.content) : msg.content;
  
        // LENIENT CHECK: Just look for SUCCESS flag
        // We do NOT strictly compare sectionId === currentTask.id anymore.
        // If the AI successfully wrote *any* section, we treat the task as progressed.
        if (content.status === 'SUCCESS' || content._written === true) {
          success = true;
          // Capture full content for Synthesis node (reads entire report before writing summaries)
          newDraftContent = content.content ?? "Section saved.";
          
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
      //SUCCESS: Update Drafts & Increment Index
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
      //FAILURE: Retry
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
      dumpAgentContext(draftReportId, taskName, [feedbackMessage], 'OUTPUT', undefined, reportTitle);
  
      return { 
          builderRetries: retryCount + 1, 
          messages: [feedbackMessage], 
          next_step: 'builder' 
      };
    }
  }