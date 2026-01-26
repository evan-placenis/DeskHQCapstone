# Migration Summary: AI_Strategies → AI-SDK with Skills

## Overview
This migration moves the system from custom `AI_Strategies` workflows to using the Vercel AI-SDK with a skills-based architecture.

## New Files Created

### Services
1. **`src/backend/src/Services/ChatService.new.ts`**
   - New ChatService using AI-SDK ChatOrchestrator
   - Handles streaming responses
   - Integrates with reportSkills when report context is available
   - Maintains same public API as old ChatService

2. **`src/backend/src/Services/ReportService.new.ts`**
   - New ReportService using AI-SDK ReportOrchestrator
   - Returns streaming results instead of completed reports
   - Uses skills-based tools for report generation
   - Maintains same public API for non-generation methods

### Routes
3. **`src/app/api/chat/sessions/[sessionId]/route.new.ts`**
   - New chat route using AI-SDK
   - Handles message sending with streaming support
   - Uses ChatServiceNew

4. **`src/app/api/project/[projectId]/reports/generate/route.new.ts`**
   - New report generation route using AI-SDK
   - Returns streaming response
   - Includes PUT endpoint to save completed reports

### Skills
5. **`src/backend/src/AI_Skills/skills/knowledge.skills.ts`**
   - New knowledge skills for RAG/search
   - Provides `searchInternalKnowledge` and `getProjectSpecs` tools

### Orchestrators
6. **`src/backend/src/AI_Skills/orchestrators/ChatOrchestrator.ts`**
   - Updated ChatOrchestrator with proper .ts extension
   - Conditionally includes reportSkills when report context is available
   - Uses knowledgeSkills and researchSkills

## Modified Files

### Skills Updates
1. **`src/backend/src/AI_Skills/skills/research.skills.ts`**
   - Fixed `searchInternalKnowledge` to match KnowledgeService.search signature (string[] → string[])
   - Updated parameter from `z.array(z.string())` to `z.string()`

2. **`src/backend/src/AI_Skills/skills/report.skills.ts`**
   - Fixed to properly use projectId and userId context
   - Added `getReportStructure` tool
   - Improved `updateSection` tool implementation

3. **`src/backend/src/AI_Skills/orchestrators/ReportOrchestrator.ts`**
   - Fixed to properly call `reportSkills(projectId, userId)` as a function
   - Added researchSkills and knowledgeSkills to tools
   - Improved system prompt

## Key Differences

### Old Architecture (AI_Strategies)
- Custom workflow classes (ParallelDispatcher, SequentialAuthor, etc.)
- AgentFactory creates workflows with custom agents
- Synchronous report generation
- Custom ChatOrchestrator with agent chain

### New Architecture (AI-SDK)
- Skills-based tools using `tool()` from 'ai' package
- ReportOrchestrator and ChatOrchestrator use `streamText()`
- Streaming responses for better UX
- ModelStrategy provides unified model interface

## Migration Steps

1. **Test the new services** with the `.new.ts` files
2. **Update Container** to optionally use new services
3. **Update routes** to use new route files
4. **Test streaming** in the frontend
5. **Gradually migrate** by switching imports

## Notes

- All old files are preserved (not deleted)
- New files use `.new.ts` suffix for easy identification
- The new services maintain backward compatibility where possible
- Streaming requires frontend updates to handle `toDataStreamResponse()`

## Next Steps

1. Test ChatServiceNew with real chat sessions
2. Test ReportServiceNew with report generation
3. Update frontend to handle streaming responses
4. Update Container to provide new services
5. Gradually switch over routes
6. Remove `.new` suffix once migration is complete
