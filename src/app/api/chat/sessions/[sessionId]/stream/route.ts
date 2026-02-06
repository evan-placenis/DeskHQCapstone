// 🆕 Streaming Chat Route for @assistant-ui/react-ai-sdk
// GET = chat history, POST = stream new messages
import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

// GET chat history (same shape as sessions/[sessionId] GET, so frontend can use /stream for both)
export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const session = await Container.chatRepo.getSessionById(sessionId, supabase);
        if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
        const uiMessages = session.messages.map(m => ({
            id: m.messageId,
            role: m.sender,
            content: m.content,
            data: m.suggestion ? { suggestion: m.suggestion } : undefined
        }));
        return NextResponse.json(uiMessages);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const body = await req.json();
        const { messages, activeSectionId, reportId, projectId, provider = 'gemini-cheap' } = body;

        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return new Response('Unauthorized', { status: 401 });
        }

        // Ensure session exists - use repo directly to avoid initializing old system
        let session = await Container.chatRepo.getSessionById(sessionId, supabase);

        if (!session) {
            if (!projectId) {
                return new Response('Project ID required', { status: 400 });
            }
            session = await Container.chatService.startSession(user.id, projectId, supabase, reportId);
        }

        const effectiveSessionId = session.sessionId;

        const userText = Container.chatService.getLastUserMessageTextFromBody(body);
        if (userText?.trim()) {
            try {
                await Container.chatService.addMessageToDatabase(effectiveSessionId, 'user', userText, supabase);
            } catch (err) {
                console.error('Failed to save user message:', err);
            }
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
            provider: provider as 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap',
            context: reportContext,
            projectId: session.projectId,
            userId: session.userId,
            reportId,  // Pass reportId to enable edit skills
            systemMessage,
            client: supabase
        });

        // Persist assistant reply when stream completes (fire-and-forget)
        Promise.resolve(streamResult.text).then((fullText) => {
            const text = (fullText ?? '').trim();
            if (!text) return;
            return Container.chatService.addMessageToDatabase(effectiveSessionId, 'assistant', text, supabase);
        }).catch((err) => console.error('Failed to save assistant message:', err));

        // Return streaming response
        return streamResult.toUIMessageStreamResponse();
    } catch (error: any) {
        console.error("❌ Streaming Chat Error:", error);
        return new Response(error.message || 'Internal server error', { status: 500 });
    }
}
