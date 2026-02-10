/**
 * Chat Skills – for the conversational Chat agent (ChatOrchestrator).
 *
 * The chat agent's role: when the user asks a question (about the report or
 * anything else), respond in the chat. Research skills (searchInternalKnowledge,
 * searchWeb) are added alongside so the chatbot can research when necessary to
 * answer the user's query. Report section writing and report-content editing
 * live in report.skills and the Edit flow, not here.
 *
 * Add chat-specific tools here only if needed (e.g. clarify question, summarize thread).
 */
export const chatSkills = {
  // Responding in chat is the default; research tools are provided by research.skills.
};
