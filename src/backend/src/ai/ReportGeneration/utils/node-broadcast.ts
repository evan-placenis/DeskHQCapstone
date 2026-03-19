import { Container } from "@/backend/config/container";

/**
 * Characters to accumulate before flushing a broadcast.
 * Prevents flooding the Supabase Realtime channel with single-token packets
 * while still giving a smooth typewriter effect.
 */
const FLUSH_THRESHOLD = 40;

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
      console.warn('[NodeBroadcast] agent_thought failed:', err);
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
