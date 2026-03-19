/**
 * A manual adapter to stream LangGraph events to the frontend.
 * Bypasses the need for 'ai' package imports.
 */
export const CustomLangChainAdapter = {
    toDataStreamResponse(stream: AsyncIterable<any>) {
      const encoder = new TextEncoder();
  
      const readable = new ReadableStream({
        async start(controller) {
          // Iterate through the LangGraph event stream
          for await (const event of stream) {
            // 1. Handle Text Streaming (The "Matrix" effect)
            if (event.event === "on_chat_model_stream" && event.data.chunk?.content) {
              const content = event.data.chunk.content;
              if (typeof content === "string" && content.length > 0) {
                // Vercel Protocol: 0:"quoted_string" \n
                controller.enqueue(encoder.encode(`0:${JSON.stringify(content)}\n`));
              }
            }
            // 2. Handle Tool Calls (Optional - adds "Thinking..." UI if your frontend supports it)
            // You can add more logic here later if needed
          }
          controller.close();
        }
      });
  
      return new Response(readable, {
        headers: { 
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Vercel-AI-Data-Stream': 'v1'
        }
      });
    }
  };