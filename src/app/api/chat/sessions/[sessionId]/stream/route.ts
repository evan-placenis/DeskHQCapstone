// 🆕 Streaming Chat Route for @assistant-ui/react-ai-sdk
import { NextRequest } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { messages, activeSectionId, reportId, projectId, provider = 'grok' } = body;

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Ensure session exists - use repo directly to avoid initializing old system
        let session = await Container.chatRepo.getSessionById(sessionId, supabase);

        if (!session) {
            // Create session if it doesn't exist using ChatServiceNew from Container
            if (!projectId) {
                return new Response('Project ID required', { status: 400 });
            }
            session = await Container.chatService.startSession(user.id, projectId, supabase, reportId);
        }

        // Get report context if available
        let reportContext: any = null;
        if (reportId && activeSectionId) {
            try {
                reportContext = await Container.reportService.getSectionContextForAI(
                    reportId,
                    activeSectionId,
                    supabase
                );
            } catch (error) {
                console.error(`⚠️ Failed to fetch section context:`, error);
            }
        }

        // Build system message if we have report context
        let systemMessage: string | undefined = undefined;
        if (reportContext) {
            // Simple text extraction from section
            const contextText = reportContext.title
                ? `# ${reportContext.title}\n\n${reportContext.description || ''}`
                : reportContext.description || '';
            systemMessage = `You are helping edit a report section. Current section content:\n\n${contextText}\n\nWhen the user asks to edit this section, use the updateSection tool.`;
        }

        // Generate stream using the orchestrator from Container
        const streamResult = await Container.chatOrchestrator.generateStream({
            messages: messages || [],
            provider: provider as 'grok' | 'gemini' | 'claude',
            context: reportContext,
            projectId: session.projectId,
            userId: session.userId,
            systemMessage,
            client: supabase
        });

        // Return streaming response
        return streamResult.toUIMessageStreamResponse();
    } catch (error: any) {
        console.error("❌ Streaming Chat Error:", error);
        return new Response(error.message || 'Internal server error', { status: 500 });
    }
}
