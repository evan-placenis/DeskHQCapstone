

export const STATUS_STAGES = {
    CONTEXT: "Reviewing project scope and guidelines...",
    ANALYSIS: "Analyzing site photos and identifying observations...",
    KNOWLEDGE: "Cross-referencing project specifications and standards...",
    WRITING: "Drafting report sections...",
    FINALIZING: "Finalizing report structure...",
  };
  
  export class StreamingAdapter {
    private lastStatus: string = "";
  
    /**
     * Converts a technical tool name into a professional status message.
     * Also deduplicates so we don't spam the same status.
     */

    

    getFriendlyStatus(toolName: string, input: any): string | null {
      // 1. Safe Input Extraction (Handles nested args)
      const args = input?.args ||input?.kwargs || input || {};
      
      // 2. Extract Reasoning (The "Why")
      const reasoning = args.reasoning || args.strategy || "";
      
      // 3. Format based on Tool
      switch (toolName) {
        case 'writeSection':
          const title = args.heading || args.sectionId || "Section";
          // Format: Header + Reasoning
          let msg = `## Drafting Section: ${title}`;
          if (reasoning) msg += `\n**Strategy:** ${reasoning}`;
          return msg;

        case 'searchInternalKnowledge':
          const query = args.query || args.text || "specs";
          const shortQuery = query.length > 60 ? query.substring(0, 60) + "..." : query;
          return `### Querying Internal Database\n**Subject:** ${shortQuery}`;

        case 'searchWeb':
          return `### Initiating Web Research\n**Query:** ${args.query}`;

        default:
          return null; // Don't log internal/boring tools
      }
        
        // case 'analyze_batch_images':
        //   const count = input?.imageUrls?.length || 0;
        //   newStatus = `Performing visual analysis on ${count} images...`;
        //   break;
        // case 'getReportStructure':
        //   newStatus = "Reviewing existing report structure and sections to understand what sections already exist...";
        //   break;
        // case 'getProjectImageURLsWithIDS':
        //   newStatus = "Fetching project images from the database...";
        //   break;
        // case 'getProjectSpecs':
        //   newStatus = "Fetching project specifications from the database...";
        //   break;
   }


    getFriendlyCompletion(toolName: string, output: any): string | null {
      // 1. Safe Output Extraction
      let data = output;

      // 1. Safe JSON Parse (The Crash Fix)
      // We only parse if it's a string AND looks like an object/array.
      // Otherwise, we treat it as raw text.
      if (typeof output === 'string') {
        const trimmed = output.trim();
        if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          try {
            data = JSON.parse(output);
          } catch (e) {
            // Parsing failed? No problem. Use the raw string.
            data = output;
          }
        }
      }
    
       // 2. Formatting Logic
  switch (toolName) {
    case 'writeSection':
      // Expecting an object from the write tool
      if (typeof data === 'object' && (data.status === 'SUCCESS' || data._written)) {
        const title = data.heading || data.sectionId || "Section";
        const preview = data.preview || data.content || "";
        // Clean up the preview for the log
        const shortPreview = preview.length > 150 
          ? preview.substring(0, 150).replace(/\n/g, ' ') + "..." 
          : preview;
        return `### Section Saved: ${title}\n> *"${shortPreview}"*`;
      }
      return `### Write Failed\nSystem could not save the section.`;

    case 'searchInternalKnowledge':
    case 'searchWeb':
      // 🛡️ Robustness: Handle if data is an Array (from your new Service)
      if (Array.isArray(data)) {
        // If it's a raw array, just grab the first item's source/content to show
        const firstItem = data[0];
        const snippet = firstItem?.content || JSON.stringify(firstItem);
        return `### Database Results\n> *Found ${data.length} matches. Top result: "${snippet.substring(0, 100)}..."*`;
      }
       // Expecting a string (your new format)
       // If 'data' is still an object (rare), stringify it.
       const results = typeof data === 'string' ? data : JSON.stringify(data);
       
       // Remove the internal header to make the log cleaner
       const cleanResults = results
         .replace('[MEMORY MATCH FOUND]:', '')
         .trim();
       
       const snippet = cleanResults;
         
       return `### Database Results\n> *${snippet}*`;

        default:
          return null;
      }
   }
}