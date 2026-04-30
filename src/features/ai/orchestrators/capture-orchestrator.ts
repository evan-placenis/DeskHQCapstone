import { streamText, stepCountIs } from 'ai';
import { ModelStrategy } from '@/features/ai/services/models/model-strategy';
import { researchTools } from '@/features/ai/tools/chatbot-research-tools';
import { buildSkillPrompt, loadSkill } from '@/features/ai/services/chatbot/skill-loader';
import type { HeliconeContextInput } from '@/src/features/ai/services/models/gateway/helicone-context-builder';
import { logger } from '@/lib/logger';
import type { AiSdkChatProvider } from '@/lib/ai-providers';
import { DEFAULT_AI_SDK_CHAT_PROVIDER } from '@/lib/ai-providers';

export type DescribeOnePhotoChunk = {
  id: number;
  text: string;
  startMs: number;
  endMs: number;
};

export type DescribeOnePhotoParams = {
  projectImageId: string;
  image: { mimeType: string; base64: string };
  transcriptChunks: DescribeOnePhotoChunk[];
  projectId: string;
  provider?: AiSdkChatProvider;
  /** When set, requests route through Helicone (same as chat). Requires HELICONE_API_KEY in the worker. */
  heliconeInput?: HeliconeContextInput;
};

const PHOTO_DESCRIBER_USER_TEMPLATE_KEY = 'capture/photo-describer-user';
const PHOTO_DESCRIBER_SYSTEM_KEY = 'capture/photo-describer-system';

function buildUserMessage(
  projectImageId: string,
  chunks: DescribeOnePhotoChunk[],
): string {
  const template = loadSkill(PHOTO_DESCRIBER_USER_TEMPLATE_KEY).body.trim();
  const transcriptBlock =
    chunks.length === 0
      ? '(no transcript chunks were assigned to this photo)'
      : chunks
          .map(
            (c) =>
              `- [${(c.startMs / 1000).toFixed(2)}s - ${(c.endMs / 1000).toFixed(2)}s] ${c.text}`,
          )
          .join('\n');
  return template
    .replace(/\{\{PROJECT_IMAGE_ID\}\}/g, projectImageId)
    .replace(/\{\{TRANSCRIPT_CHUNKS\}\}/g, transcriptBlock);
}

/**
 * Capture Orchestrator (AI-SDK).
 *
 * Sole consumer today is Pass 2 (Describer) of the capture audio pipeline:
 * `describeOnePhoto` runs a one-shot agent loop with research tools available
 * for resolving jargon while writing a single field note.
 */
export class CaptureOrchestrator {
  /**
   * Describe a single photo using the agent loop. Returns the final field-note text.
   * Runs inside Trigger.dev (no streaming HTTP response); we await `result.text`.
   */
  async describeOnePhoto(params: DescribeOnePhotoParams): Promise<string> {
    const {
      projectImageId,
      image,
      transcriptChunks,
      projectId,
      provider = DEFAULT_AI_SDK_CHAT_PROVIDER,
      heliconeInput,
    } = params;

    const tools = researchTools(projectId, { persistWebSearchToDb: false });

    const systemPrompt = buildSkillPrompt([PHOTO_DESCRIBER_SYSTEM_KEY]);
    const userText = buildUserMessage(projectImageId, transcriptChunks);

    const imageBuffer = Buffer.from(image.base64, 'base64');

    const result = streamText({
      model: ModelStrategy.getModel(provider, heliconeInput),
      system: systemPrompt,
      stopWhen: stepCountIs(6),
      tools,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', image: imageBuffer, mediaType: image.mimeType },
            { type: 'text', text: userText },
          ],
        },
      ],

      experimental_onToolCallStart({ toolCall }: { toolCall: { toolName: string; toolCallId: string } }) {
        logger.info(`[Capture/Describer] Tool call: ${toolCall.toolName} (${toolCall.toolCallId})`);
      },
    } as Parameters<typeof streamText>[0]);

    const text = await result.text;
    return (text ?? '').trim();
  }
}
