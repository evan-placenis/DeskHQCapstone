import { ToolMessage, AIMessage} from "@langchain/core/messages";
import { reportSkills } from "../skills/report.skills";
import { researchSkills } from "../skills/research.skills"; 
import { chatSkills} from "../skills/chat.skills";
import { visionSkills } from "../skills/vision.skills";

export async function toolNode(state: any) {
  const { messages, projectId, userId, client, selectedImageIds } = state;
  const lastMessage = messages[messages.length - 1];

  // 1. Guard Clause: No tools requested?
  if (!lastMessage.tool_calls || lastMessage.tool_calls.length === 0) {
    return { messages: [] };
  }

  // 2. Re-Instantiate Tools
  // We need the *same* tools that the Writer used
  const reportTools = reportSkills(projectId, userId, client, selectedImageIds);
  const chatTools = chatSkills(projectId, userId);
  const researchTools= researchSkills(projectId);
  const visionTools = visionSkills;

  // 3. MERGE THEM
  // This creates one big object: { updateSection: Tool, searchWeb: Tool, ... }
  const allToolsMap: Record<string, any> = {};

  [...reportTools, ...chatTools, ...researchTools, ...visionTools].forEach(tool => {
    allToolsMap[tool.name] = tool;
  });

  const results: ToolMessage[] = [];

  // 4. EXECUTE
  if (lastMessage.tool_calls?.length) {
    for (const call of lastMessage.tool_calls) {
      const tool = allToolsMap[call.name]; // <--- Simple lookup
      
      if (tool) {
        console.log(`🛠️ ToolNode: Executing ${call.name}`);
        try {
          // The tool logic lives in your skills file. We just invoke it here.
          const output = await tool.invoke(call.args);

          results.push(new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            content: JSON.stringify(output)
          }));
        } catch (e: any) {
          results.push(new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            content: `Error: ${e.message}`
          }));
        }
      } else {
        console.error(`⚠️ Tool ${call.name} not found in registry.`);
        // Optional: Return an error to the LLM so it knows it hallucinated
        results.push(new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            content: "Error: Tool not found."
        }));
      }
    }
  }

  return { messages: results };
}