import { SystemMessage } from "@langchain/core/messages";
import { ModelStrategy } from "../../models/modelStrategy";
// Import tool factories to bind them
import { reportSkills } from "../../../LangGraph_skills/report.skills";
import { researchSkills } from "../../../LangGraph_skills/research.skills"; 
import { chatSkills} from "../../../LangGraph_skills/chat.skills";

export async function chatNode(state: any) {
  const { messages, context, projectId, userId, client, selectedImageIds, provider, systemMessage } = state;

  // 1. Define Base Tools (Research, Chat, Vision)
  const baseTools = [
    ...chatSkills(projectId, userId),
    ...researchSkills(projectId),
  ];

  // 2. Conditionally Add Report Editing Tools
  // (Matching your original "if context && projectId..." logic)
  const reportTools = context && projectId
    ? reportSkills(projectId, userId, client, selectedImageIds ?? [])
    : [];
  const activeTools = [...baseTools, ...reportTools];

  // 3. Bind Tools to Model
  const baseModel = ModelStrategy.getModel(provider || 'gemini-cheap');
  const model = typeof baseModel.bindTools === 'function'
    ? baseModel.bindTools(activeTools)
    : baseModel;

  // 4. Define System Prompt
  const defaultSystemPrompt = `You are a helpful research assistant.
  1. ALWAYS search 'searchInternalKnowledge' first for project specifics.
  2. If the answer is missing, use 'searchWeb'.
  3. Answer strictly based on the tool outputs.
  ${context ? '4. You can edit report sections using "updateSection" when explicitly asked.' : ''}`;

  const finalSystemPrompt = systemMessage || defaultSystemPrompt;

  // 5. Invoke
  const response = await model.invoke([
    new SystemMessage(finalSystemPrompt),
    ...messages
  ]);

  return { messages: [response] };
}