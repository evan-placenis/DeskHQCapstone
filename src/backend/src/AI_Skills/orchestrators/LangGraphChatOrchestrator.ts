import { HumanMessage, AIMessage } from "@langchain/core/messages";
import { chatGraph } from '../LangGraph/workflow/chat/chatGraph'; // Adjust path if needed
import { CustomLangChainAdapter } from '../LangGraph/utils/custom-adapter'; // Your manual adapter
import { SupabaseClient } from "@supabase/supabase-js";

interface GenerateChatParams {
  messages: any[];
  context?: string;
  projectId: string;
  userId: string;
  provider?: string;
  systemMessage?: string;
  client: SupabaseClient; // Pass the authenticated client
}

export class ChatOrchestrator {
  
  /**
   * Orchestrates the Chat loop:
   * 1. Converts messages to LangChain format
   * 2. Initializes the Graph State
   * 3. Streams the response using the Custom Adapter
   */
  async generateStream(params: GenerateChatParams) {
    const { 
      messages, 
      context, 
      projectId, 
      userId, 
      provider, 
      systemMessage, 
      client 
    } = params;

    // 1. Convert Messages
    // Map standard Vercel/OpenAI messages to LangChain classes
    const langChainMessages = messages.map((m: any) => 
      m.role === 'user' ? new HumanMessage(m.content) : new AIMessage(m.content)
    );

    // 2. Prepare Graph Input State
    // We populate the 'TeamState' required by your graph
    const inputState = {
      messages: langChainMessages,
      context: context || "",
      projectId: projectId,
      userId: userId,
      provider: provider || "gemini-cheap",
      systemMessage: systemMessage,
      client: client, 
      
      // Defaults for fields not used heavily in simple chat, 
      // but required by the TeamState definition
      selectedImageIds: [],
      currentSection: "chat-session", 
    };

    // 3. Run & Stream
    // We use .streamEvents to capture "on_chat_model_stream" (tokens) and "on_tool_start"
    const stream = await chatGraph.streamEvents(inputState, {
      version: "v2",
    });

    // 4. Return formatted response
    return CustomLangChainAdapter.toDataStreamResponse(stream);
  }
}

// import { streamText, convertToModelMessages, stepCountIs } from 'ai';
// import { ModelStrategy } from '../Models/model-strategy';
// import { researchSkills } from '../skills/research.skills';
// import { reportSkills } from '../skills/report.skills';
// import { chatSkills } from '../skills/chat.skills';
// import { visionSkills } from '../skills/vison.skills';
// import { channel } from 'diagnostics_channel';
// import { SupabaseClient } from '@supabase/supabase-js';

// /**
//  * 🆕 Chat Orchestrator using AI-SDK
//  * 
//  * This orchestrator handles chat conversations with access to:
//  * - Knowledge base search (RAG)
//  * - Web research
//  * - Report editing (when report context is provided)
//  */
// export class ChatOrchestrator {
//     async generateStream(params: {
//         messages: any[],
//         provider: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap',
//         context?: any,
//         projectId?: string,
//         userId?: string,
//         systemMessage?: string
//         client: SupabaseClient;
//     }) {
//         const { messages, provider, context, projectId, userId, systemMessage, client } = params;

//         // Build tools - include report skills if we have context
//         const tools: any = {
//             ...researchSkills(projectId ?? ''),
//             ...chatSkills,
//             ...visionSkills
//         };

//         // If we have report context and IDs, add report editing skills
//         if (context && projectId && userId) {
//             Object.assign(tools, reportSkills(projectId, userId, client));
//         }

//         // Build system prompt - use custom systemMessage if provided, otherwise default
//         const systemPrompt = systemMessage || `You are a helpful research assistant.
//                1. ALWAYS search 'searchInternalKnowledge' first.
//                2. If the answer is missing or low confidence, use 'searchWeb'.
//                3. Answer strictly based on the tool outputs.
//                ${context ? '4. You can edit report sections using "updateSection" when the user requests changes in the report they are editing..' : ''}`;

//         return streamText({
//             model: ModelStrategy.getModel(provider),
//             messages: await convertToModelMessages(messages),
//             system: systemPrompt,
//             stopWhen: stepCountIs(10),
//             tools
//         });
//     }
// }
