import { CaptureOrchestrator } from '../AI_Skills/orchestrators/CaptureOrchestrator';
import { SupabaseClient } from '@supabase/supabase-js';

export interface AnalyzeAudioParams {
  /** URLs of audio files to analyze (e.g. Supabase storage signed URLs) */
  audioUrls: string[];
  /** Optional user prompt, e.g. "Transcribe this recording" or "Summarize the key observations" */
  prompt?: string;
  /** AI provider to use */
  provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
  projectId?: string;
  userId?: string;
  reportId?: string;
  /** Supabase client for auth/storage */
  client: SupabaseClient;
  /** Called when the model finishes (e.g. to persist the transcript) */
  onFinish?: (event: { text: string; finishReason: string }) => void | Promise<void>;
}

/**
 * AudioService bridges API routes and the AudioOrchestrator.
 * Use it to transcribe, summarize, or analyze audio recordings.
 */
export class CaptureService {
  constructor(private orchestrator: CaptureOrchestrator) {}

  /**
   * Stream audio analysis (transcription, summary, etc.) using the AI orchestrator.
   * Returns the stream result so the caller can pipe it to the response (e.g. toUIMessageStreamResponse).
   */
  async analyzeAudioStream(params: AnalyzeAudioParams) {
    const {
      audioUrls,
      prompt = 'Transcribe and summarize this audio recording.',
      provider = 'gemini-cheap',
      projectId,
      userId,
      reportId,
      client,
      onFinish,
    } = params;

    const userMessage = audioUrls.length > 0
      ? `${prompt}\n\nAudio files to analyze:\n${audioUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
      : prompt;

    const messages = [{ role: 'user' as const, content: userMessage }];

    const systemMessage = `You are an assistant for engineering site inspections and report writing.
When the user provides audio file URLs, use your audio analysis tools to process them.
Provide a clear transcription and/or summary of the key observations, safety notes, or findings.
If the user asks for a specific format (e.g. bullet points, report section), structure your response accordingly.`;

    return this.orchestrator.generateStream({
      messages,
      provider,
      projectId,
      userId,
      reportId,
      client,
      systemMessage,
      onFinish,
    });
  }

  /**
   * Non-streaming: analyze audio and return the full text result.
   * Useful when you need the complete transcript before doing something else.
   */
  async analyzeAudio(params: Omit<AnalyzeAudioParams, 'onFinish'>): Promise<string> {
    const streamResult = await this.analyzeAudioStream(params);

    let fullText = '';
    for await (const chunk of streamResult.textStream) {
      fullText += chunk;
    }

    return fullText;
  }
}
