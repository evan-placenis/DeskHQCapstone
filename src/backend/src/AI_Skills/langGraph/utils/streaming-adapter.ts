

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
      let newStatus = "";
  
      switch (toolName) {
        case 'searchInternalKnowledge':
          // Extract the query but shorten it if it's too long
            const internalQuery = input?.query || input?.text || "";
            const shortInternal = internalQuery.length > 40 ? internalQuery.substring(0, 40) + "..." : internalQuery;
            newStatus = `Searching project database for "${shortInternal}"...`;
          break;
        case 'analyze_batch_images':
          const count = input?.imageUrls?.length || 0;
          newStatus = `Performing visual analysis on ${count} images...`;
          break;
        case 'writeSection':
          const section = input?.heading || "content";
          newStatus = `Drafting section: ${section}...`;
          break;
        case 'searchWeb':
          newStatus = `Web searching for "${input?.query}"...`;
          break;
        case 'submit_report':
          newStatus = "Assembling finalized report and formatting styles...";
          break;
        case 'getReportStructure':
          newStatus = "Reviewing existing report structure and sections to understand what sections already exist...";
          break;
        case 'getProjectImageURLsWithIDS':
          newStatus = "Fetching project images from the database...";
          break;
        case 'getProjectSpecs':
          newStatus = "Fetching project specifications from the database...";
          break;
        default:
            // You can log internal tool names to the console for debugging, 
            // but keep them away from the user.
            console.log(`[Adapter] Skipping internal tool: ${toolName}`);
            return null;
      }
  
      // Deduplication Logic: Only return if the status actually changed
      if (newStatus === this.lastStatus) return null;
      
      this.lastStatus = newStatus;
      return newStatus;
    }
  }