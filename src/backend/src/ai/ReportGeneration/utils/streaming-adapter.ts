/**
 * StreamingAdapter
 *
 * Translates raw LangGraph `on_chat_model_stream` events into human-readable text
 * to broadcast to the frontend.
 *
 * All nodes now use the same model-agnostic pattern:
 *   - The model writes free-form reasoning text (chunk.content) BEFORE calling tools.
 *   - That content streams token-by-token and is captured here uniformly.
 *   - Tool call args (chunk.tool_call_chunks) are deliberately ignored — they carry
 *     structured JSON that should never be shown raw to the user.
 *
 * Usage in processStreamEvent (generateReport.ts):
 *   on_chain_start        → streamingAdapter.onNodeStart(event.name)
 *   on_chat_model_stream  → newText = streamingAdapter.feedModelChunk(chunk, nodeName)
 *   on_tool_start         → streamingAdapter.getFriendlyStatus(toolName, input)
 */

/**
 * Extracts plain text from an AIMessageChunk, handling both the string form
 * (Claude / OpenAI) and the array-of-parts form (Gemini).
 * Exported so individual nodes can use it in their own streaming loops.
 */
export function extractTextContent(chunk: any): string {
  if (!chunk) return '';
  const content = chunk.content;
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .filter((part: any) => typeof part === 'object' && part.type === 'text')
      .map((part: any) => part.text ?? '')
      .join('');
  }
  return '';
}

export class StreamingAdapter {
  /**
   * Call when a new graph node starts.
   * Returns an optional status string to broadcast, or null for no update.
   */
  onNodeStart(nodeName: string): string | null {
    switch (nodeName) {
      case 'synthesis_builder':
        return 'Finalizing report...';
      case 'builder':
        return 'Analyzing evidence...';
      case 'architect':
        return 'Planning report structure...';
      default:
        return null;
    }
  }

  /**
   * Returns a formatted status line for `on_tool_start`, or null if the tool
   * is not interesting enough to surface in the status bar.
   */
  getFriendlyStatus(toolName: string, input: any): string | null {
    const args = input?.args ?? input?.kwargs ?? input ?? {};

    switch (toolName) {
      case 'submitReportPlan':
        return 'Finalizing report structure...';

      case 'writeSection': {
        const title = args.heading ?? args.sectionId ?? 'Section';
        let msg = `## Drafting: ${title}`;
        return msg;
      }

      case 'searchInternalKnowledge': {
        const query: string = args.query ?? args.text ?? 'specs';
        const short = query.length > 60 ? query.substring(0, 60) + '...' : query;
        return `Querying internal knowledge base\n**Subject:** ${short}`;
      }

      case 'searchWeb':
        return `Searching the web\n**Query:** ${args.query}`;

      default:
        return null;
    }
  }

  /**
   * Returns a formatted completion message for `on_tool_end`, or null if
   * the tool output is not worth surfacing.
   */
  getFriendlyCompletion(toolName: string, output: any): string | null {
    let data = output;
    if (typeof output === 'string') {
      const trimmed = output.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
        try { data = JSON.parse(output); } catch { /* use raw string */ }
      }
    }

    switch (toolName) {
      case 'writeSection': {
        if (typeof data === 'object' && (data.status === 'SUCCESS' || data._written)) {
          const title = data.heading ?? data.sectionId ?? 'Section';
          const preview: string = data.preview ?? data.content ?? '';
          const short = preview.length > 150
            ? preview.substring(0, 150).replace(/\n/g, ' ') + '...'
            : preview;
          return `**Section saved:** ${title}\n> *"${short}"*`;
        }
        return 'Write failed — system could not save the section.';
      }

      case 'searchInternalKnowledge':
      case 'searchWeb': {
        if (Array.isArray(data)) {
          const first = data[0];
          const snippet = (first?.content ?? JSON.stringify(first) ?? '').substring(0, 100);
          return `Found ${data.length} results. Top match: *"${snippet}..."*`;
        }
        const results = typeof data === 'string' ? data : JSON.stringify(data);
        const clean = results.replace('[MEMORY MATCH FOUND]:', '').trim();
        return `${clean.substring(0, 150)}`;
      }

      default:
        return null;
    }
  }
}
