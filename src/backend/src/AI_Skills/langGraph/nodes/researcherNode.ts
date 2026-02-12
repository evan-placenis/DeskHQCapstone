import { ModelStrategy } from '../models/modelStrategy';
import { researchSkills } from '../../LangGraph_skills/research.skills';
import { SystemMessage } from "@langchain/core/messages";

// This is a "Worker" in your factory
export async function researcherNode(state: any) {
  const { context, messages, currentSection, provider, userId, projectId, client } = state;
  const systemPrompt = `
 
    ---
    PROJECT CONTEXT:
    ${state.context}
  `;
  
  // Notice we ONLY pass the report writing skills, not the vision skills
  const tools = researchSkills(projectId); 

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



  // Extract research findings from the response for shared memory
  // This allows the builder to access research without parsing messages
  let researchFindings = '';
  if (response.content) {
    researchFindings = typeof response.content === 'string' 
      ? response.content 
      : JSON.stringify(response.content);
  }

  // Return the result to the state
  return { 
    messages: [response],
    lastWrittenSection: currentSection,
    researchFindings: researchFindings || undefined, // Only set if we have findings
  };
}