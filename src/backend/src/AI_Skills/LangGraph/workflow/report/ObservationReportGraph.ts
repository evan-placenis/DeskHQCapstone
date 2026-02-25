import { StateGraph, END, START} from "@langchain/langgraph";
import { ToolMessage } from "@langchain/core/messages";
import { ObservationState } from "../../state/report/ObservationState";
import { architectNode } from "../../nodes/report/observation/architectNode";
import { humanApprovalNode } from "../../nodes/report/observation/humanApprovalNode";
import { researcherNode } from "../../nodes/researcherNode";
import { builderNode, builderContinueNode } from "../../nodes/report/observation/builderNode";
import { reviewerNode } from "../../nodes/report/observation/reviewerNode";
import { synthesisBuilderNode} from "../../nodes/report/observation/synthesisBuilderNode";
import { toolNode } from "../../nodes/toolNode";
import { AIMessage } from "@langchain/core/messages";
import { fetchContextNode } from "../../nodes/report/observation/fetchContextNode";
import { sharedCheckpointer } from "../checkpointer"; 

import { builderToolsNode } from "../../nodes/report/observation/builderToolNode";

const workflow = new StateGraph(ObservationState)

  // Nodes
  .addNode("fetch_context", fetchContextNode)
  .addNode("architect", architectNode)
  .addNode("human_approval", humanApprovalNode)
  .addNode("builder", builderNode)
  .addNode("builder_continue", builderContinueNode)
  .addNode("builder_tools", builderToolsNode)
  // .addNode("reviewer", reviewerNode)
  .addNode("synthesis_builder", synthesisBuilderNode)

  // --- EDGES ---

  // 1. Start -> fetch_context (Hydrate State)
  .addEdge(START, "fetch_context")

  //2. fetch_context -> architext (Plan)
  .addEdge("fetch_context", "architect")

  // 3. Architect -> Approval (Pause)
  .addEdge("architect", "human_approval")

  // 4. Approval Logic
  .addConditionalEdges("human_approval", (state) => {
    return state.next_step || 'architect'; // Default to architect if null/undefined
  }, {
    "builder": "builder",
    "architect": "fetch_context", //Refetches fresh data, THEN goes to architect
  })

  // 5. Builder Logic (Generate Content)
  .addConditionalEdges("builder", (state) => {
    return state.next_step || 'builder_continue'; // Default to builder_continue if null/undefined
  }, {
    "tools": "builder_tools", // Route to DEDICATED builder tools
    "builder_continue": "builder_continue",
  })

  // 6. Tool Logic (Close the Loop)
  // If the builder used a tool, go BACK to the builder so it can read the result
  .addConditionalEdges("builder_tools", (state) => {
    const lastMsg = state.messages[state.messages.length - 1];
    if (lastMsg instanceof ToolMessage && lastMsg.name !== 'writeSection') {
      console.log(`🧠 [Router] Research detected (${lastMsg.name}). Returning to Builder.`);
      return 'builder';
    }
    return 'builder_continue';
  }, {
    "builder": "builder",
    "builder_continue": "builder_continue",
  })

  // 7. Builder Loop
  // This node checks: "Are there more sections to write?"
  .addConditionalEdges("builder_continue", (state) => {
    return state.next_step || 'reviewer'; // Default to FINISH if null/undefined
  }, {
    "builder": "builder",
    // "reviewer": "reviewer", // All observations done? Review them.
    "reviewer": "synthesis_builder",
  })

  // .addEdge("reviewer", "synthesis_builder")

  .addEdge("synthesis_builder", END)


// Compile with SHARED checkpointer
// CRITICAL: Must use sharedCheckpointer (not new MemorySaver()) so resume route can access the same state
export const observationReportGraph = workflow.compile({
  checkpointer: sharedCheckpointer,
  interruptBefore: ["human_approval"], // Pauses BEFORE human_approval node runs
});