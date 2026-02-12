import { StateGraph, END } from "@langchain/langgraph";
import { ObservationState } from "../../state/report/ObservationState";
import { architectNode } from "../../nodes/report/observation/architectNode";
import { humanApprovalNode } from "../../nodes/report/observation/humanApprovalNode";
import { researcherNode } from "../../nodes/researcherNode";
import { builderNode, builderContinueNode } from "../../nodes/report/observation/builderNode";
import { reviewerNode } from "../../nodes/report/observation/reviewerNode";
import { toolNode } from "../../nodes/toolNode";
import { AIMessage } from "@langchain/core/messages";
import { sharedCheckpointer } from "../checkpointer";

import { builderToolsNode } from "../../nodes/report/observation/builderToolNode";

const workflow = new StateGraph(ObservationState)

  // Nodes
  .addNode("architect", architectNode)
  .addNode("human_approval", humanApprovalNode)
  // .addNode("researcher", researcherNode)
  .addNode("builder", builderNode)
  .addNode("builder_continue", builderContinueNode)
  .addNode("builder_tools", builderToolsNode)
  // .addNode("reviewer", reviewerNode)
  

  // --- EDGES ---

  // 1. Start -> Architect
  .addEdge("__start__", "architect")

  // 2. Architect -> Approval
  .addEdge("architect", "human_approval")

  // 3. Approval -> Router
  .addConditionalEdges("human_approval", (state) => {
    const nextStep = state.next_step || 'architect'; // Default to architect if null/undefined
    return nextStep;
  }, {
    "builder": "builder",
    "architect": "architect",
  })

  // // 4. Researcher Logic
  // .addConditionalEdges("researcher", (state) => {
  //   const lastMessage = state.messages[state.messages.length - 1] as AIMessage;
  //   // Check if Researcher called a tool
  //   return (lastMessage?.tool_calls?.length ?? 0) > 0 ? "tools" : "done";
  // }, {
  //   "tools": "research_tools", // Route to DEDICATED researcher tools
  //   "done": "builder",         // When done, handoff to builder
  // })

  // // ✅ FIX 3: Research Tools loop back to Researcher
  // .addEdge("research_tools", "researcher")

  // 5. Builder Logic
  .addConditionalEdges("builder", (state) => {
    const nextStep = state.next_step || 'builder_continue'; // Default to builder_continue if null/undefined
    return nextStep;
  }, {
    "tools": "builder_tools", // Route to DEDICATED builder tools
    "builder_continue": "builder_continue",
    "FINISH": END, // Handle early finish cases (no report plan, no tasks, etc.)
  })

  // ✅ FIX 4: Builder Tools go to Builder Continue
  .addEdge("builder_tools", "builder_continue")

  // 6. Builder Loop
  .addConditionalEdges("builder_continue", (state) => {
    const nextStep = state.next_step || 'FINISH'; // Default to FINISH if null/undefined
    return nextStep;
  }, {
    "builder": "builder",
    "tools": "builder_tools",
    "reviewer": END, // Reviewer is commented out, but handle gracefully
    "FINISH": END,
  })

  // // 7. Reviewer Logic
  // .addConditionalEdges("reviewer", (state) => state.next_step, {
  //   "builder": "builder",
  //   "FINISH": END,
  // });

// Compile with SHARED checkpointer
// CRITICAL: Must use sharedCheckpointer (not new MemorySaver()) so resume route can access the same state
export const observationReportGraph = workflow.compile({
  checkpointer: sharedCheckpointer,
  interruptBefore: ["human_approval"], // Pauses BEFORE human_approval node runs
});