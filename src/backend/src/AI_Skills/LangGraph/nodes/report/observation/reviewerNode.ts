import { SystemMessage, HumanMessage, ToolMessage, AIMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy";
import { tool } from "@langchain/core/tools";
import { z } from "zod";
import { ObservationState } from "../../../state/report/ObservationState";

export async function reviewerNode(state: typeof ObservationState.State) {
  const { 
    sectionDrafts, 
    reportPlan, 
    structureInstructions, 
    systemPrompt, 
    provider 
  } = state;

  console.log("🧐 [Reviewer] Starting holistic audit (Single Pass)...");

  // 1. PREPARE THE FULL MANUSCRIPT
  // We format it clearly so the LLM can see the flow.
  if (!sectionDrafts || Object.keys(sectionDrafts).length === 0) {
     return { reviewScore: 0, critiqueNotes: "No content to review." };
  }

  const manuscript = Object.entries(sectionDrafts)
    .map(([title, content]) => `
    <<< SECTION: ${title} >>>
    ${content}
    <<< END SECTION >>>
    `)
    .join("\n\n");

  // 2. DEFINE THE EDITING TOOLS in seperate file!
  // These tools allow the AI to surgically alter the state.
  
  const rewriteTool = tool(async ({ sectionTitle, newContent, reason }) => {
      console.log(`  ✏️ [Reviewer] Rewriting "${sectionTitle}"...`);
      return { status: "UPDATED", sectionTitle, newContent, reason };
  }, {
      name: "rewrite_section",
      description: "Rewrite a specific section to fix tone, formatting, or errors. REPLACE the entire text.",
      schema: z.object({
          sectionTitle: z.string().describe("The EXACT title of the section to rewrite"),
          newContent: z.string().describe("The full, polished text for this section"),
          reason: z.string().describe("Why you are changing it (e.g. 'Fixed passive voice')")
      })
  });

  const mergeTool = tool(async ({ title1, title2, newTitle, mergedContent }) => {
      console.log(`  🔗 [Reviewer] Merging "${title1}" and "${title2}"...`);
      return { status: "MERGED", title1, title2, newTitle, mergedContent };
  }, {
      name: "merge_sections",
      description: "Combine two weak or redundant sections into one strong section.",
      schema: z.object({
          title1: z.string(),
          title2: z.string(),
          newTitle: z.string(),
          mergedContent: z.string()
      })
  });

  const deleteTool = tool(async ({ sectionTitle, reason }) => {
      console.log(`  🗑️ [Reviewer] Deleting "${sectionTitle}"...`);
      return { status: "DELETED", sectionTitle, reason };
  }, {
      name: "delete_section",
      description: "Remove a section that is empty, irrelevant, or duplicate.",
      schema: z.object({
          sectionTitle: z.string(),
          reason: z.string()
      })
  });

  const tools = [rewriteTool, mergeTool, deleteTool];

  // 3. CONSTRUCT THE PROMPT
  const editorPrompt = `
    ROLE: Senior Technical Editor.
    
    STANDARDS (The Rubric):
    ${structureInstructions}

    TASK:
    You are reading the COMPLETE draft report below.
    Your goal is to polish it into a final professional document.
    
    1. **Holistic Check:** Does the report flow logically? Are there contradictions between sections?
    2. **Tone Check:** Fix any unprofessional language ("I think", "maybe").
    3. **Action:**
       - Use 'rewrite_section' to fix individual sections.
       - Use 'merge_sections' if two sections are repetitive.
       - Use 'delete_section' if a section is empty or useless.
       - If a section is perfect, DO NOTHING.
    
    DRAFT MANUSCRIPT:
    ${manuscript}
  `;

  // 4. INVOKE MODEL (With Tools)
  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
    if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  const model = baseModel.bindTools(tools);
  
  // We allow the model to make multiple tool calls in parallel (Gemini/OpenAI support this)
  const response = await model.invoke([
    new SystemMessage(systemPrompt || "You are a strict Editor."),
    new HumanMessage(editorPrompt)
  ]);

  const aiMsg = response as AIMessage;
  
  // 5. APPLY THE EDITS TO STATE
  // We start with a copy of the original drafts and mutate it based on tool calls.
  let finalDrafts = { ...sectionDrafts };
  let changeLog: string[] = [];
  let scorePenalty = 0;

  if (aiMsg.tool_calls && aiMsg.tool_calls.length > 0) {
    for (const call of aiMsg.tool_calls) {
        const args = call.args;
        
        if (call.name === "rewrite_section") {
            if (finalDrafts[args.sectionTitle]) {
                finalDrafts[args.sectionTitle] = args.newContent;
                changeLog.push(`Rewrote "${args.sectionTitle}": ${args.reason}`);
                scorePenalty += 10;
            }
        } 
        else if (call.name === "delete_section") {
            delete finalDrafts[args.sectionTitle];
            changeLog.push(`Deleted "${args.sectionTitle}": ${args.reason}`);
            scorePenalty += 15;
        }
        else if (call.name === "merge_sections") {
            // Delete old ones, add new one
            delete finalDrafts[args.title1];
            delete finalDrafts[args.title2];
            finalDrafts[args.newTitle] = args.mergedContent;
            changeLog.push(`Merged "${args.title1}" & "${args.title2}"`);
            scorePenalty += 5;
        }
    }
  }

  // Calculate a "Quality Score" based on how much work the editor had to do
  // Base 100, minus penalties for errors found.
  const finalScore = Math.max(0, 100 - scorePenalty);
  
  console.log(`✅ [Reviewer] Edit Complete. Score: ${finalScore}. Changes: ${changeLog.length}`);

  // 6. RETURN UPDATES
  return {
    sectionDrafts: finalDrafts, // <--- The polished version
    reviewScore: finalScore,
    critiqueNotes: `
      REVIEW SUMMARY:
      Score: ${finalScore}/100
      Changes Made:
      ${changeLog.map(c => `- ${c}`).join("\n")}
    `
  };
}