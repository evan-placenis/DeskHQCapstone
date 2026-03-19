/**
 * AI provider names used by the Vercel AI SDK stack (chat, edit, capture orchestrators).
 * LangChain report-graph code uses a different vocabulary (claude/gemini/…) — see REPORT_GRAPH_PROVIDERS.
 */

export const AI_SDK_CHAT_PROVIDERS = ["grok", "gemini-pro", "claude", "gemini-cheap"] as const;

export type AiSdkChatProvider = (typeof AI_SDK_CHAT_PROVIDERS)[number];

export const DEFAULT_AI_SDK_CHAT_PROVIDER: AiSdkChatProvider = "gemini-cheap";

export function normalizeAiSdkChatProvider(value: unknown): AiSdkChatProvider {
  return AI_SDK_CHAT_PROVIDERS.includes(value as AiSdkChatProvider)
    ? (value as AiSdkChatProvider)
    : DEFAULT_AI_SDK_CHAT_PROVIDER;
}

/** Provider keys for report workflow / LangChain ModelStrategy (UI + report-orchestrator). */
export const REPORT_GRAPH_PROVIDERS = ["claude", "gemini", "grok", "openai"] as const;

export type ReportGraphProvider = (typeof REPORT_GRAPH_PROVIDERS)[number];
