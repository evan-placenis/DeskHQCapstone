import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/model-strategy";
import { ObservationState } from "../../../state/pretium/observation-state";
import { Container } from "@/lib/container";
import { dumpAgentContext } from "../../../utils/agent-logger";
import * as fs from 'fs';
import * as path from 'path';
export async function synthesisBuilderNode(state: typeof ObservationState.State) {
  const {
    reportPlan,
    sectionDrafts,
    structureInstructions,
    draftReportId,
    reportTitle,
    systemPrompt,
    provider,
    heliconeInput,
  } = state;
  if (!reportPlan) {
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
  // streaming:false — synthesis writes complete sections in one invoke call.
  // Keeping streaming:true here causes LangGraph's streamEvents to emit
  // on_chat_model_stream events for the synthesis output, which can appear
  // in the frontend reasoning panel unexpectedly.
  const model = ModelStrategy.getModel(provider || 'gemini', 'lightweight', heliconeInput, false);
  const freshClient = Container.adminClient;


  // Repo-root skills/ — run Trigger from project root (see trigger.config.ts).
  const skillsDir = path.join(process.cwd(), '..', '..', 'skills');
  const skillPath = path.join(skillsDir, 'summarize.md');
  let summarizeSkill = fs.readFileSync(skillPath, 'utf-8');
  const exampleReport = fs.readFileSync(path.join(skillsDir, 'example-report.md'), 'utf-8');

  // Build the massive cached prompt ONCE so it will be cached by Gemini.
  const combinedSystemPrompt = `
  ${systemPrompt}
  ---
  GLOBAL REPORT STRUCTURE (For Context Only):
  ${structureInstructions}
  ---
  ${summarizeSkill}
  ---
  ${exampleReport}

  ---
  INPUT DATA (The Report Findings needed for Context):
  ${reportContext}


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
        dumpAgentContext(taskName, [systemBlock, new HumanMessage(prompt)], 'INPUT', reportTitle || "", undefined);

        const response = await model.invoke([
          systemBlock,
          new HumanMessage(prompt)
        ]);

        // 📝 Log the OUTPUT (What the AI just generated / The tools it wants to call)
        dumpAgentContext(taskName, [response], 'OUTPUT', reportTitle || "", undefined);

        const rawText = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);

        // Strip any leading markdown heading the model included (e.g. "# GENERAL\n\n")
        // The heading is already stored separately via section.title — rendering it twice
        // creates a double-heading in the final report.
        const headingRegex = /^#+\s+[^\n]+\n+/;
        const cleanContent = headingRegex.test(rawText) ? rawText.replace(headingRegex, '').trim() : rawText.trim();

        newContent[section.title] = cleanContent;
        success = true;

        // SAVE TO DATABASE (Critical Fix): We must persist this immediately so the final compiler sees it.
        if (draftReportId) {
          try {
            const safeOrder = Math.floor(Number(section.reportOrder));
            await Container.reportService.updateSectionInReport(
              draftReportId,
              section.sectionId,
              section.title,
              cleanContent,
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