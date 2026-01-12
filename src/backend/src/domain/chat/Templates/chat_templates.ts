// agents/templates/PlannerTemplate.ts

import { ExecutionPlan } from "../../../AI_Strategies/ChatSystem/interfaces";

// A "Blank" or "Example" structure we want the AI to mimic.
// We put dummy data in it so the AI understands the semantics.
export const PlannerExampleTemplate: ExecutionPlan = {
  steps: [
    {
      intent: "RESEARCH_DATA",
      instruction: "Search for specific specs regarding X",
      reasoning: "Need external context first"
    },
    {
      intent: "EDIT_TEXT",
      instruction: "Update section 3 with the new specs",
      reasoning: "User asked to apply changes"
    }
  ]
};