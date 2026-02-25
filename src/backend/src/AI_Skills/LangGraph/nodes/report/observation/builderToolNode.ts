import { ToolMessage, AIMessage} from "@langchain/core/messages";
import { reportSkills } from "../../../../LangGraph_skills/report.skills";
import { researchSkills } from "../../../../LangGraph_skills/research.skills"; 
import { ObservationState } from "../../../state/report/ObservationState";
import { Container } from "../../../../../config/container";

export async function builderToolsNode(state: typeof ObservationState.State) {
  const { 
    messages, 
    projectId, 
    userId, 
    selectedImageIds, 
    draftReportId,
  } = state;

  const lastMessage = messages[messages.length - 1];

  // ✅ FIX: Get a fresh, working client
  // Since this is a background job, Admin rights are usually appropriate/necessary
  const freshClient = Container.adminClient;

  // 1. Define Tools 
  // ⚠️ CRITICAL: This list MUST be identical to the list in 'builderNode.ts'
  // We removed visionSkills because the AI now has native eyes (Multimodal).
  const builderTools = [
      ...reportSkills(freshClient),
      ...researchSkills(projectId)
  ];

  // 2. Create Lookup Map
  const toolsMap: Record<string, any> = {};
  builderTools.forEach(tool => { 
    toolsMap[tool.name] = tool; 
  });

  const results: ToolMessage[] = [];
  const aiMsg = lastMessage as AIMessage;
  // 3. Execute Tools
  if (aiMsg.tool_calls?.length) {
    for (const call of aiMsg.tool_calls) {
      const tool = toolsMap[call.name];

      if (tool) {
        console.log(`🏗️ [BuilderTools] Executing ${call.name}`);

        // 🛡️ SECURITY OVERRIDE: ALWAYS FORCE THE REPORT ID for writeSection
        // The AI often confuses Project ID, User ID, or Title for the Report ID.
        // We ALWAYS override to ensure the correct reportId from state is used.
        if (call.name === 'writeSection') {
          if (!draftReportId) {
            console.error(`❌ [BuilderTools] CRITICAL: draftReportId is missing in state! Cannot write section.`);
            results.push(new ToolMessage({
              tool_call_id: call.id || "undefined",
              name: call.name,
              content: `ERROR: Report ID is missing. Cannot save section.`
            }));
            continue; // Skip this tool call
          }
          const aiReportId = call.args.reportId;
          if (aiReportId !== draftReportId) {
            console.log(`🛡️ [Security] Overriding AI's reportId ("${aiReportId}") with state draftReportId: "${draftReportId}"`);
          }
          call.args.reportId = draftReportId; // ALWAYS override, regardless of what AI provided
        }
    
        try {
            // Invoke the tool with the arguments provided by the AI
            const output = await tool.invoke(call.args);

            // Log success to help debug streaming
            console.log(`✅ [BuilderTools] Output length: ${JSON.stringify(output).length} with content: ${JSON.stringify(output)}`);

            results.push(new ToolMessage({
                tool_call_id: call.id || "undefined",
                name: call.name,
                content: typeof output === 'string' ? output : JSON.stringify(output)
            }));
        } catch (e: any) {
            console.error(`❌ [BuilderTools] Error in ${call.name}:`, e);
            results.push(new ToolMessage({
                tool_call_id: call.id || "undefined",
                name: call.name,
                content: `ERROR: Tool execution failed. Details: ${e.message}`
            }));
        }
      } else {
        // 🛡️ Security Block
        // If the AI hallucinates a tool we didn't give it (e.g. "search_google"), block it.
        console.warn(`⛔ [BuilderTools] Blocked unauthorized tool: '${call.name}'`);
        results.push(new ToolMessage({
            tool_call_id: call.id || "undefined",
            name: call.name,
            content: "ERROR: You do not have access to this tool. Use only the provided tools."
        }));
      }
    }
  }

  // 4. Return Results
  // LangGraph will append these ToolMessages to the 'messages' array
  return { messages: results };
}


// import { ToolMessage } from "@langchain/core/messages";
// import { reportSkills } from "../../../../LangGraph_skills/report.skills";
// import { visionSkillsWithReport } from "../../../../LangGraph_skills/vision.skills";
// import { researchSkills } from "../../../../LangGraph_skills/research.skills";
// import { Container } from "@/backend/config/container";
// export async function builderToolsNode(state: any) {
//   const { messages, projectId, userId, selectedImageIds, draftReportId, processingMode } = state;
//   const lastMessage = messages[messages.length - 1];

//   const freshClient = Container.adminClient;
//   const includeVision = processingMode !== 'TEXT_ONLY';

//   const builderTools = [
//      ...reportSkills(projectId, userId, freshClient, selectedImageIds),
//      ...(includeVision ? visionSkillsWithReport(draftReportId, freshClient) : []),
//      ...researchSkills(projectId)
//   ];

//   // 2. Map them
//   const toolsMap: Record<string, any> = {};
//   builderTools.forEach(tool => { toolsMap[tool.name] = tool; });

//   const results: ToolMessage[] = [];

//   // 3. Execute
//   if (lastMessage.tool_calls?.length) {
//     for (const call of lastMessage.tool_calls) {
//       const tool = toolsMap[call.name];

//       if (tool) {
//         console.log(`🏗️ Builder Tool: Executing ${call.name}`);
//         try {
//             const output = await tool.invoke(call.args);
//             // ... (standard output handling)
//              results.push(new ToolMessage({
//                 tool_call_id: call.id,
//                 name: call.name,
//                 content: JSON.stringify(output)
//             }));
//         } catch (e: any) {
//              // ... error handling
//         }
//       } else {
//         // 🛑 THIS IS THE FIX 🛑
//         // If the AI tries to use 'searchWeb' (monkey see, monkey do), 
//         // this node will reject it because it didn't load researchSkills!
//         console.error(`⛔ Security Block: Builder tried to use unauthorized tool '${call.name}'`);
//         results.push(new ToolMessage({
//             tool_call_id: call.id,
//             name: call.name,
//             content: "ERROR: You do not have access to this tool. Focus on WRITING the report."
//         }));
//       }
//     }
//   }
//   return { messages: results };
// }