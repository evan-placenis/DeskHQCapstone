// agents/templates/PlannerTemplate.ts

import { ExecutionPlan } from "../../../AI_Strategies/ChatSystem/interfaces";

// A "Blank" or "Example" structure we want the AI to mimic.
// We put dummy data in it so the AI understands the semantics.
export const PlannerExampleTemplate: ExecutionPlan = {
  steps: [
    {
      intent: "RESEARCH_DATA",
      instruction: "Search for specific specs regarding X",
      reasoningText: "Need external context first"
    },
    {
      intent: "EDIT_TEXT",
      instruction: "Update section 3 with the new specs",
      reasoningText: "User asked to apply changes"
    }
  ]
};

// Example for a question/guidance request (no edits)
export const PlannerRespondExample: ExecutionPlan = {
  steps: [
    {
      intent: "RESPOND",
      instruction: "Explain what information should be included in the executive summary section",
      reasoningText: "User is asking for guidance, not requesting an edit"
    }
  ]
};

// Example for a mixed request (research + respond)
export const PlannerMixedExample: ExecutionPlan = {
  steps: [
    {
      intent: "RESEARCH_DATA",
      instruction: "Find the standard requirements for foundation assessments",
      reasoningText: "Need to gather information first"
    },
    {
      intent: "RESPOND",
      instruction: "Summarize the requirements and explain how they apply to this report",
      reasoningText: "User wants information, not direct edits to the document"
    }
  ]
};