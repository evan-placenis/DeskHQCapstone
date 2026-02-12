import { SystemMessage, AIMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../../models/modelStrategy"; // Check your imports
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

export async function reviewerNode(state: any) {
  const { 
    reportPlan,
    sectionDrafts,
    provider,
    critiqueNotes, // Previous notes
    messages,
    reviewCount = 0 // Default to 0 if undefined
  } = state;

  // 1. Guard: Infinite Loop Prevention
  // If we have already reviewed 3 times, force finish to avoid bankruptcy.
  if (reviewCount >= 3) {
    console.warn("⚠️ Reviewer: Max retries reached. Forcing finish.");
    return {
      next_step: 'FINISH',
      critiqueNotes: "Finalized due to max retries.",
      reviewCount: reviewCount + 1
    };
  }

  // 2. Assemble Draft
  const fullDraft = reportPlan.sections
    .map((section: any) => {
      // Add a visual separator for the AI to read easily
      return `### SECTION: ${section.title} (ID: ${section.sectionId})\n${sectionDrafts[section.sectionId] || '(CONTENT MISSING)'}`;
    })
    .join('\n\n' + '='.repeat(20) + '\n\n');

  // 3. Define the Tool (Structured Output)
  const reviewSchema = z.object({
    score: z.number().min(0).max(100).describe('Quality score (0-100). 80+ is passing.'),
    issues: z.array(z.string()).describe('List of specific issues. Be concise.'),
    recommendation: z.enum(['APPROVE', 'REVISE']).describe('Decision.'),
    // specific_section_ids: z.array(z.string()).optional().describe('If REVISE, list specific section IDs to fix. If empty, rewrites all.')
  });

  const reviewTool = tool(
    async (args) => { return args; }, // No-op, we just want the args
    {
      name: 'submitReview',
      description: 'Submit the final review decision.',
      schema: reviewSchema
    }
  );

  // 4. Prompt
  const systemPrompt = `${state.context}

---
REVIEWER PHASE: QUALITY CONTROL (Round ${reviewCount + 1}/3)
---
You are the Lead Engineer. Review the draft report below.

CRITERIA:
1. **Completeness:** Are all sections filled?
2. **Evidence:** Are photos referenced (e.g. "Image [uuid]")?
3. **Tone:** Professional, objective, engineering voice.
4. **Safety:** Are defects clearly marked with severity?

DRAFT CONTENT:
${fullDraft}

PREVIOUS CRITIQUE (Did they fix it?):
${critiqueNotes || 'None'}

INSTRUCTIONS:
- If Score < 80, you MUST select 'REVISE'.
- If 'REVISE', list specific issues in the 'issues' field.
`;

  // 5. Invoke Model
  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');

  if (typeof baseModel.bindTools !== 'function') {
    throw new Error("Model does not support tools");
 }
  
  // Force the tool call so we always get structured data
  const model = baseModel.bindTools([reviewTool], {
    tool_choice: "submitReview"
  });

  const response = await model.invoke([
    new SystemMessage(systemPrompt)
  ]);

  // 6. Extract Result
  const aiMsg = response as AIMessage;
  const toolCall = aiMsg.tool_calls?.[0];

  // Default fallback if model fails
  let nextStep = 'FINISH'; 
  let newCritique = '';
  let score = 100;

  if (toolCall && toolCall.name === 'submitReview') {
    const args = toolCall.args;
    score = args.score;
    const issues = args.issues || [];
    const recommendation = args.recommendation;

    newCritique = `Round ${reviewCount + 1} Feedback:\n` + issues.map((i: string) => `- ${i}`).join('\n');
    
    // Logic: Pass if Approved OR Score is high enough
    if (recommendation === 'APPROVE' || score >= 80) {
      console.log(`✅ Reviewer: Approved (Score ${score})`);
      nextStep = 'FINISH';
    } else {
      console.log(`🔄 Reviewer: Rejecting (Score ${score}). Looping back.`);
      nextStep = 'builder';
    }
  }

  // 7. Return State Updates
  return {
    messages: [response], // Log the review
    reviewScore: score,
    critiqueNotes: newCritique, // This updates the state so Builder sees it
    reviewCount: reviewCount + 1, // Increment counter
    next_step: nextStep,
    
    // NUCLEAR RESET: Yes, we force a full rewrite for coherence.
    // Ideally, we would selectively reset, but that is complex.
    currentSectionIndex: nextStep === 'builder' ? 0 : state.currentSectionIndex
  };
}