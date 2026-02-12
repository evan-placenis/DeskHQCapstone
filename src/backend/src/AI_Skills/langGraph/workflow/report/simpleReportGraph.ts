import { StateGraph, END } from "@langchain/langgraph";
import { TeamState } from "../../state/report/TeamState";
// Import your nodes (we assume you have created these files based on previous steps)
import { researcherNode } from "../../nodes/researcherNode";
import { writerNode } from "../../nodes/report/writerNode";
import { supervisorNode } from "../../nodes/supervisorNode";
import { toolNode } from "../../nodes/toolNode";

import { AIMessage } from "@langchain/core/messages";

// 1. Initialize the Graph with your State Schema
const workflow = new StateGraph(TeamState)

  // 2. Add Nodes (The Workers)
  .addNode("supervisor", supervisorNode)
  .addNode("researcher", researcherNode)
  .addNode("writer", writerNode)
  .addNode("tools", toolNode)

  // 3. Define Edges (The Logic Flow)
  .addEdge("__start__", "supervisor") // Start at supervisor

  // 4. Conditional Logic (The Brain)
  // The Supervisor decides who goes next based on the 'next_step' key in state
  .addConditionalEdges("supervisor", (state) => {
    // 1. Log what the supervisor actually decided (Crucial for debugging)
    console.log("👮 Supervisor decided:", state.next_step);

    // 2. Safety Fallback
    // If next_step is missing or null, force it to end or retry
    if (!state.next_step) {
        console.warn("⚠️ Supervisor returned null next_step. Ending workflow.");
        return "FINISH"; 
    }

    return state.next_step;
}, {
    "research": "researcher",
    "write": "writer",
    "FINISH": END
})
  // Logic: Writer -> Tool OR Supervisor
  .addConditionalEdges("writer", (state) => {
    const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
    // Native check for tool calls
    if (lastMsg.tool_calls?.length) {
      return "tools";
    }
    return "supervisor"; // Done writing, go back to manager
  })

  // 5. Loops (The Return Trip)
  // After a worker finishes, they report back to the supervisor
  .addEdge("researcher", "supervisor")
  .addEdge("writer", "supervisor")
  // Logic: Tool -> Writer (Always loop back so Writer sees the result)
  .addEdge("tools", "writer");

// 6. Compile and Export
export const simpleReportGraph = workflow.compile();