//POST (Accept Suggestion)

import { NextResponse } from 'next/server';
import {Container} from '@/backend/config/container'

export async function POST(
    req: Request,
    { params }: { params: { sessionId: string } }
) {
    try {
        // We expect the messageId in the body so we know WHICH suggestion to accept
        const { messageId } = await req.json();
        
        const chatService = Container.chatService

        await chatService.acceptSuggestion(params.sessionId, messageId);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}