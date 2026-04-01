import { Container } from "@/lib/container";
import { logger } from "@/lib/logger";

/**
 * Characters to accumulate before flushing a broadcast.
 * Prevents flooding the Supabase Realtime channel with single-token packets
 * while still giving a smooth typewriter effect.
 */
const FLUSH_THRESHOLD = 40;

/** Stay under typical WebSocket / Realtime payload limits when sending reasoning text. */
const MAX_BROADCAST_PAYLOAD_CHARS = 8000;

/** Small pause between sequential chunks so the UI can render progressively after a single `.invoke()`. */
const CHUNK_BROADCAST_DELAY_MS = 40;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Split full reasoning text into paragraph-sized pieces, then hard-cap each piece by character count.
 */
export function splitReasoningIntoBroadcastChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const chunks: string[] = [];
  const paragraphs = trimmed.split(/\n\n+/);

  for (const para of paragraphs) {
    if (para.length <= MAX_BROADCAST_PAYLOAD_CHARS) {
      chunks.push(para);
    } else {
      for (let i = 0; i < para.length; i += MAX_BROADCAST_PAYLOAD_CHARS) {
        chunks.push(para.slice(i, i + MAX_BROADCAST_PAYLOAD_CHARS));
      }
    }
  }
  return chunks;
}

async function sendAgentThoughtChunk(projectId: string, chunk: string): Promise<void> {
  if (!chunk) return;
  const supabase = Container.adminClient;
  const channelName = `project-${projectId}`;
  const channel = supabase.channel(channelName);
  await channel.httpSend("agent_thought", { chunk, projectId }).catch((err: unknown) => {
    logger.warn("[NodeBroadcast] agent_thought failed:", err);
  });
}

/**
 * After a non-streaming `.invoke()`, replay the full chain-of-thought to the UI in safe chunks
 * with a short delay between sends (progressive feel without token streaming).
 */
export async function broadcastChunkedReasoning(projectId: string, text: string): Promise<void> {
  const parts = splitReasoningIntoBroadcastChunks(text);
  for (let i = 0; i < parts.length; i++) {
    await sendAgentThoughtChunk(projectId, parts[i]);
    if (i < parts.length - 1) {
      await sleep(CHUNK_BROADCAST_DELAY_MS);
    }
  }
}

/**
 * Creates a stateful token broadcaster for use inside a LangGraph node.
 *
 * Nodes call `push(text)` for each streamed token. Tokens are buffered locally
 * and sent as a single `agent_thought` broadcast whenever the buffer reaches
 * FLUSH_THRESHOLD characters. Call `flush()` at the end of the stream to send
 * any remaining partial buffer.
 *
 * This is the correct way to broadcast from inside a node rather than relying
 * on LangGraph's `streamEvents` outer loop, which forces every model call into
 * streaming mode (including tool-call JSON) and causes Gemini's SDK to crash
 * with "Failed to parse stream".
 *
 * @param projectId - The Supabase channel is `project-${projectId}`
 */
export function createNodeBroadcaster(projectId: string) {
  let buffer = '';
  const supabase = Container.adminClient;
  const channelName = `project-${projectId}`;

  async function flush(): Promise<void> {
    if (!buffer) return;
    const toSend = buffer;
    buffer = '';
    const channel = supabase.channel(channelName);
    await channel.httpSend('agent_thought', { chunk: toSend, projectId }).catch((err: unknown) => {
      logger.warn('[NodeBroadcast] agent_thought failed:', err);
    });
  }

  async function push(text: string): Promise<void> {
    if (!text) return;
    buffer += text;
    if (buffer.length >= FLUSH_THRESHOLD) {
      await flush();
    }
  }

  return { push, flush };
}
