import { SystemMessage, HumanMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { ObservationState } from "../../../state/report/ObservationState";
import { Container } from "../../../../../config/container";
export async function synthesisBuilderNode(state: typeof ObservationState.State) {
  const { 
    reportPlan, 
    sectionDrafts, 
    structureInstructions, 
    draftReportId,
    systemPrompt, 
    provider
  } = state;

  console.log("🧩 [Synthesis] Checking for missing report sections...");

  // 1. IDENTIFY GAPS
  // We look at the Master Plan and see what the Builder didn't write.
  const existingTitles = new Set(Object.keys(sectionDrafts || {}));
  if(!reportPlan) {
    console.error("❌ [Synthesis] No report plan found!");
    return { next_step: "FINISH" };
  }
  const sectionsToWrite = reportPlan.sections.filter(section => 
    !existingTitles.has(section.title)
  );

  if (sectionsToWrite.length === 0) {
    console.log("✅ [Synthesis] No gaps found. Report is complete.");
    return { next_step: "FINISH" };
  }

  console.log(`📝 [Synthesis] Generating: ${sectionsToWrite.map(s => s.title).join(", ")}`);

  // 2. PREPARE CONTEXT (The Evidence)
  // The LLM needs to read the DETAILED observations to write the high-level summary.
  // ⚠️ CRITICAL: This reads from MEMORY (State). 
  // If sectionDrafts is empty here, the Summary will be bad.
  const observationsContext = Object.entries(sectionDrafts || {})
    .map(([title, content]) => `
    === EVIDENCE FROM ${title} ===
    ${content}
    `)
    .join("\n\n");

  const newContent: Record<string, string> = {};
  const model = ModelStrategy.getModel(provider || 'gemini-pro'); 
  const freshClient = Container.adminClient;

  // 3. GENERATE MISSING SECTIONS
  for (const section of sectionsToWrite) {
    let success = false;
    let attempts = 0;
    const MAX_RETRIES = 3;
    const prompt = `
        ROLE: Senior Principal Engineer.
        
        TASK: 
        Write the section "**${section.title}**" for a structural inspection report.
        
        PURPOSE OF THIS SECTION (From Plan):
        ${section.purpose || "Provide a high-level overview and actionable next steps."}

        INPUT DATA (The Findings):
        ${observationsContext}

        STRICT FORMATTING RULES:
        ${structureInstructions}

      `;

    // 🔄 RETRY LOOP
    while (!success && attempts < MAX_RETRIES) {
      attempts++;
      console.log(`✍️ [Synthesis] Writing "${section.title}"...`);
      try {
        const response = await model.invoke([
          new SystemMessage(systemPrompt || "You are an expert technical writer."),
          new HumanMessage(prompt)
        ]);

        const text = typeof response.content === 'string' ? response.content : JSON.stringify(response.content);
        newContent[section.title] = text;

        // 2. MARK SUCCESS HERE (The AI did its job)
        success = true;

        // 💾 SAVE TO DATABASE (Critical Fix)
        // We must persist this immediately so the final compiler sees it.
        if (draftReportId) {
          try {
              const safeOrder = Math.floor(Number(section.reportOrder));
              await Container.reportService.updateSectionInReport(
                  draftReportId,
                  section.sectionId,
                  section.title,
                  text,
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
  // 4. MERGE & SORT
  // Combine the drafts
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

  // 4. FINISH
  // Merge the new sections into the main draft list and end the graph.
  return {
    sectionDrafts: sortedDrafts,
    next_step: "FINISH" 
  };
}