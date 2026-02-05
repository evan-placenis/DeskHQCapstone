import { ModelStrategy } from '../models/modelStrategy';
import { SystemMessage } from "@langchain/core/messages";
import { reportSkills } from '../skills/report.skills';

// 1. Move your Mechanics HERE
const AGENT_MECHANICS = `
CORE BEHAVIORS:
1. ANALYZE FIRST: Gather image IDs...
2. INCREMENTAL WRITING: Use 'updateSection'...
...
`;


// This is a "Worker" in your factory
export async function writerNode(state: any) {
  const systemPrompt = `
    ${AGENT_MECHANICS}
    ---
    PROJECT CONTEXT:
    ${state.context}
  `;


  const { messages, context, currentSection, provider, userId, projectId, client } = state;
  

  
  // Notice we ONLY pass the report writing skills, not the vision skills
  const tools = reportSkills(projectId, userId, client, []); 

  // Bind Tools to Model
  // Native LangChain models accept the tool array directly
  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
  const model = typeof baseModel.bindTools === 'function'
    ? baseModel.bindTools(tools)
    : baseModel;

  // 4. Invoke
  const response = await model.invoke([
    new SystemMessage(systemPrompt),
    ...messages
  ]);

  // Return the result to the state
  return { 
    messages: [response],
    lastWrittenSection: currentSection 
  };
}