import { ToolMessage, AIMessage} from "@langchain/core/messages";
import { reportTools } from "@/features/ai/tools/report-generation-report-tools";
import { researchTools } from "@/features/ai/tools/report-generation-research-tools";
import { ObservationState } from "../../../state/pretium/observation-state";
import { Container } from "@/lib/container";

const SEARCH_TOOL_NAMES = ['searchInternalKnowledge', 'searchWeb'] as const;
const SEARCH_CIRCUIT_BREAKER_THRESHOLD = 4;

export async function builderToolsNode(state: typeof ObservationState.State) {
  const { 
    messages, 
    projectId, 
    userId, 
    selectedImageIds, 
    draftReportId,
    searchAttemptCount: stateSearchCount = 0,
  } = state;

  let searchAttemptCount = stateSearchCount;

  const lastMessage = messages[messages.length - 1];

  // ✅ FIX: Get a fresh, working client
  // Since this is a background job, Admin rights are usually appropriate/necessary
  const freshClient = Container.adminClient;

  // 1. Define Tools 
  // ⚠️ CRITICAL: This list MUST be identical to the list in 'builderNode.ts'
  // We removed visionSkills because the AI now has native eyes (Multimodal).
  const builderTools = [
      ...reportTools(freshClient),
      ...researchTools(projectId)
  ];

  // 2. Create Lookup Map
  const toolsMap: Record<string, any> = {};
  builderTools.forEach(tool => { 
    toolsMap[tool.name] = tool; 
  });

  const results: ToolMessage[] = [];
  const aiMsg = lastMessage as AIMessage;

  // // 3. Execute Tools CONCURRENTLY
  // if (aiMsg.tool_calls?.length) {
  //   console.log(`🚀 [BuilderTools] AI requested ${aiMsg.tool_calls.length} tools. Executing concurrently...`);

  //   // Map each tool call to a Promise
  //   const toolPromises = aiMsg.tool_calls.map(async (call) => {
  //     const tool = toolsMap[call.name];

  //     if (tool) {
  //       console.log(`🏗️ [BuilderTools] Firing ${call.name} (ID: ${call.id})`);

  //       // 🛡️ SECURITY OVERRIDE (Same as before)
  //       if (call.name === 'writeSection') {
  //         if (!draftReportId) {
  //           return new ToolMessage({
  //             tool_call_id: call.id || "undefined",
  //             name: call.name,
  //             content: `ERROR: Report ID is missing. Cannot save section.`
  //           });
  //         }
  //         call.args.reportId = draftReportId; 
  //       }
    
  //       try {
  //           // Invoke the tool
  //           const output = await tool.invoke(call.args);
            
  //           return new ToolMessage({
  //               tool_call_id: call.id || "undefined",
  //               name: call.name,
  //               content: typeof output === 'string' ? output : JSON.stringify(output)
  //           });
  //       } catch (e: any) {
  //           console.error(`❌ [BuilderTools] Error in ${call.name}:`, e);
  //           return new ToolMessage({
  //               tool_call_id: call.id || "undefined",
  //               name: call.name,
  //               content: `ERROR: Tool execution failed. Details: ${e.message}`
  //           });
  //       }
  //     } else {
  //       // 🛡️ Security Block for hallucinated tools
  //       console.warn(`⛔ [BuilderTools] Blocked unauthorized tool: '${call.name}'`);
  //       return new ToolMessage({
  //           tool_call_id: call.id || "undefined",
  //           name: call.name,
  //           content: "ERROR: You do not have access to this tool. Use only the provided tools."
  //       });
  //     }
  //   });

  //   // ⚡ Execute all promises at the exact same time
  //   const resolvedResults = await Promise.all(toolPromises);
    
  //   // Push the results into our final array
  //   results.push(...resolvedResults);
  // }

  //3. Execute Tools Sequentially (with search circuit breaker)
  if (aiMsg.tool_calls?.length) {
    for (const call of aiMsg.tool_calls) {
      const tool = toolsMap[call.name];

      if (tool) {
        // 🔌 CIRCUIT BREAKER: Block search after threshold to stop agent search loops
        const isSearchTool = SEARCH_TOOL_NAMES.includes(call.name as any);
        if (isSearchTool && searchAttemptCount >= SEARCH_CIRCUIT_BREAKER_THRESHOLD) {
          const query = (call.args && typeof call.args === 'object' && 'query' in call.args)
            ? String((call.args as { query?: string }).query || 'unknown')
            : 'unknown';
          const placeholder = `[MISSING: Research Data for "${query}"]`;
          console.log(`🔌 [BuilderTools] Circuit breaker: search attempt ${searchAttemptCount + 1} blocked. Returning placeholder.`);
          results.push(new ToolMessage({
            tool_call_id: call.id || "undefined",
            name: call.name,
            content: placeholder,
          }));
          continue;
        }

        if (isSearchTool) {
          searchAttemptCount += 1;
          console.log(`🔍 [BuilderTools] Search attempt ${searchAttemptCount}/${SEARCH_CIRCUIT_BREAKER_THRESHOLD}: ${call.name}`);
        }

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

            // Reset search circuit breaker after writing a section so next section gets fresh attempts
            if (call.name === 'writeSection') {
              searchAttemptCount = 0;
              console.log(`✅ [BuilderTools] Section written; searchAttemptCount reset to 0.`);
            }


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

  // 4. Return Results + updated state (circuit breaker count; reset after writeSection is already applied above)
  return { messages: results, searchAttemptCount };
}