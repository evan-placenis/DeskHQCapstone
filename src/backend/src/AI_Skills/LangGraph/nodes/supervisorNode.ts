import { ModelStrategy } from "../models/modelStrategy"; // Your existing model factory
import { SystemMessage, HumanMessage } from "@langchain/core/messages";


export async function supervisorNode(state: any) {
  const { messages, currentSection, provider,  context } = state;
  const model = ModelStrategy.getModel(provider || 'gemini-cheap');
  // 1. Define the Supervisor's Goal
  const systemPrompt = `You are the Report Manager.
  Current Context: ${context}
  
  Decide the next step.
  - If we have no data, call 'research'.
  - If we have data but no text, call 'write'.
  - If we are done, call 'FINISH'.
  
  Respond with JUST the keyword: 'research', 'write', or 'FINISH'.`;

  // 2. Call the Model
  // We use a cheap model (Gemini Flash) for routing to save money
  // 2. Native Call (No conversion needed)
  // We simply pass the System Message + the existing Chat History
  const response = await model.invoke([
    new SystemMessage(systemPrompt), 
    ...messages 
  ]);

  const decision = response.content.toString().trim();

  // 3. Update State
  // We return the decision so the Graph knows where to route
  return { 
    next_step: decision,
    // Optional: Add a thought log so the user sees what's happening
    messages: [new HumanMessage(`Supervisor decided to: ${decision}`)] 
  };
}