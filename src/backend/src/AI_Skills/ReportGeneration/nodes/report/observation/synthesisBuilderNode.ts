import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { ObservationState } from "../../../state/Pretium/ObservationState";
import { Container } from "../../../../../config/container";
import { dumpAgentContext } from "../../../utils/agent-logger";
import * as fs from 'fs';
import * as path from 'path';
export async function synthesisBuilderNode(state: typeof ObservationState.State) {
  const { 
    reportPlan, 
    sectionDrafts, 
    structureInstructions, 
    draftReportId,
    systemPrompt, 
    provider,
    heliconeInput,
  } = state;
  if(!reportPlan) {
    console.error("❌ [Synthesis] No report plan found!");
    return { next_step: "FINISH" };
  }
  console.log("🧩 [Synthesis] Checking for missing report sections...");


  // 1. IDENTIFY GAPS: We look at the Master Plan and see what the Builder didn't write.
  const existingTitles = new Set(Object.keys(sectionDrafts || {}));
  const sectionsToWrite = reportPlan.sections.filter(section => 
    !existingTitles.has(section.title)
  );

  if (sectionsToWrite.length === 0) {
    console.log("✅ [Synthesis] No gaps found. Report is complete.");
    return { next_step: "FINISH" };
  }

  console.log(`📝 [Synthesis] Generating: ${sectionsToWrite.map(s => s.title).join(", ")}`);

  // 2. PREPARE CONTEXT: The LLM needs to read the DETAILED observations to write the high-level summary.
  // CRITICAL: This reads from MEMORY (State). If sectionDrafts is empty here, the Summary will be bad.
  const reportContext = Object.entries(sectionDrafts || {})
    .map(([title, content]) => `
    === ${title} ===
    ${content}
    `)
    .join("\n\n");

  const newContent: Record<string, string> = {};
  const model = ModelStrategy.getModel(provider || 'gemini', 'lightweight', heliconeInput); 
  const freshClient = Container.adminClient;


  // LOAD SYNTHESIS SKILLS (OUTSIDE THE LOOP)
  const skillPath = path.join(process.cwd(), 'skills', 'summarize.md');
  let summarizeSkill = fs.readFileSync(skillPath, 'utf-8');
  
  // Build the massive cached prompt ONCE so it will be cached by Gemini.
  const combinedSystemPrompt = `
  ${systemPrompt}
  ---
  ${summarizeSkill}

  ---
  INPUT DATA (The Report Findings needed for Context):
  ${reportContext}

  ---
  GLOBAL REPORT STRUCTURE (For Context Only):
  ${structureInstructions}
  `;

  // Build this ONCE so Gemini can implicitly cache it across all loop iterations
  const systemBlock = new SystemMessage(combinedSystemPrompt);

  // 3. GENERATE MISSING SECTIONS
  for (const section of sectionsToWrite) {
    let success = false;
    let attempts = 0;
    const MAX_RETRIES = 3;
    
    // Keep this tiny and specific to the current loop iteration!
    const prompt = `
        TASK: Write the section "**${section.title}**" for the structural inspection report.
        
        PURPOSE OF THIS SECTION:
        ${section.purpose}
    `;

    // RETRY LOOP FOR CURRENT SECTION
    while (!success && attempts < MAX_RETRIES) {
      attempts++;
      console.log(`✍️ [Synthesis] Writing "${section.title}"...`);
      try {
        // 📝 Log the INPUT (The prompt + any RAG history it is carrying)
        const taskName = `SynthesisBuilder_Task_${section.title}`;
        dumpAgentContext(draftReportId || "", taskName, [systemBlock, new HumanMessage(prompt)], 'INPUT');

        const response = await model.invoke([
          systemBlock,
          new HumanMessage(prompt)
        ]);

        // 📝 Log the OUTPUT (What the AI just generated / The tools it wants to call)
        dumpAgentContext(draftReportId || "", taskName, [response], 'OUTPUT');

        const rawText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        newContent[section.title] = rawText;
        success = true;

        // SAVE TO DATABASE (Critical Fix): We must persist this immediately so the final compiler sees it.
        if (draftReportId) {
          try {
              const safeOrder = Math.floor(Number(section.reportOrder));
              await Container.reportService.updateSectionInReport(
                  draftReportId,
                  section.sectionId,
                  section.title,
                  rawText,
                  safeOrder, // Use the correct order from the plan
                  freshClient
              );
              console.log(`💾 [Synthesis] Saved "${section.title}" to DB.`);
          } catch (saveErr) {
              console.error(`❌ [Synthesis] Failed to save "${section.title}" to DB:`, saveErr);
          }
        }
        
      } catch (err) {
        // 🛑 FALLBACK: Retry
        console.error(`❌ [Synthesis] Failed to write "${section.title}":`, err);
        // ⏳ BACKOFF: Wait before retrying (1s, 2s, 3s)
        if (attempts < MAX_RETRIES) {
          await new Promise(resolve => setTimeout(resolve, attempts * 1000));
        } else {
              // ❌ FINAL FAIL
              console.error(`❌ [Synthesis] Failed after ${MAX_RETRIES} attempts.`);
              newContent[section.title] = "Error generating section. Please rewrite manually.";
        }
      }
    }
  }
  // 4. MERGE & SORT:Combine the drafts
  const unsortedDrafts = { ...sectionDrafts, ...newContent };

  // Re-order them according to the Original Plan
  const sortedDrafts: Record<string, string> = {};

  reportPlan.sections.forEach(section => {
    // If we have content for this plan item, add it to the new object in order
    if (unsortedDrafts[section.title]) {
      sortedDrafts[section.title] = unsortedDrafts[section.title];
    }
  });

  console.log("✅ [Synthesis] Report assembled in correct order.");

  // FINISH
  // Merge the new sections into the main draft list and end the graph.
  return {
    sectionDrafts: sortedDrafts,
    next_step: "FINISH" 
  };
}