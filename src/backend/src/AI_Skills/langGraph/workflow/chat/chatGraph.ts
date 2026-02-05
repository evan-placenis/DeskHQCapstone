import { StateGraph, END } from "@langchain/langgraph";
import { TeamState } from "../../state/TeamState"; // Reuse your existing state!
// Import your nodes (we assume you have created these files based on previous steps)
import { researcherNode } from "../../nodes/researcherNode";
import { writerNode } from "../../nodes/writerNode";
import { supervisorNode } from "../../nodes/supervisorNode";
import { toolNode } from "../../nodes/toolNode";
import { chatNode } from "../../nodes/chatNode";
import { AIMessage } from "@langchain/core/messages";

const workflow = new StateGraph(TeamState)
  .addNode("chat", chatNode)
  .addNode("tools", toolNode)

  .addEdge("__start__", "chat")

  // Logic: Did the chatbot ask for a tool?
  .addConditionalEdges("chat", (state) => {
    const lastMsg = state.messages[state.messages.length - 1] as AIMessage;
    if (lastMsg.tool_calls?.length) {
      return "tools";
    }
    return END; // No tools needed -> Return answer to user
  })

  // Logic: Tools always report back to Chat
  .addEdge("tools", "chat");

export const chatGraph = workflow.compile();