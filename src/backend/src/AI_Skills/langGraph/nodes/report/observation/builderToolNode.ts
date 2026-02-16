import { ToolMessage } from "@langchain/core/messages";
import { reportSkills } from "../../../../LangGraph_skills/report.skills";
import { visionSkills } from "../../../../LangGraph_skills/vision.skills";
import { researchSkills } from "../../../../LangGraph_skills/research.skills";
import { Container } from "@/backend/config/container";
export async function builderToolsNode(state: any) {
  const { messages, projectId, userId, selectedImageIds } = state;
  const lastMessage = messages[messages.length - 1];

  // ✅ FIX: Re-instantiate client instead of using state.client
  // State.client may be serialized/deserialized incorrectly when resuming from checkpoint
  const freshClient = Container.adminClient;

  // 1. Only load BUILDER skills
  const builderTools = [
     ...reportSkills(projectId, userId, freshClient, selectedImageIds),
     ...visionSkills,
     ...researchSkills(projectId)
  ];

  // 2. Map them
  const toolsMap: Record<string, any> = {};
  builderTools.forEach(tool => { toolsMap[tool.name] = tool; });

  const results: ToolMessage[] = [];

  // 3. Execute
  if (lastMessage.tool_calls?.length) {
    for (const call of lastMessage.tool_calls) {
      const tool = toolsMap[call.name];

      if (tool) {
        console.log(`🏗️ Builder Tool: Executing ${call.name}`);
        try {
            const output = await tool.invoke(call.args);
            // ... (standard output handling)
             results.push(new ToolMessage({
                tool_call_id: call.id,
                name: call.name,
                content: JSON.stringify(output)
            }));
        } catch (e: any) {
             // ... error handling
        }
      } else {
        // 🛑 THIS IS THE FIX 🛑
        // If the AI tries to use 'searchWeb' (monkey see, monkey do), 
        // this node will reject it because it didn't load researchSkills!
        console.error(`⛔ Security Block: Builder tried to use unauthorized tool '${call.name}'`);
        results.push(new ToolMessage({
            tool_call_id: call.id,
            name: call.name,
            content: "ERROR: You do not have access to this tool. Focus on WRITING the report."
        }));
      }
    }
  }
  return { messages: results };
}