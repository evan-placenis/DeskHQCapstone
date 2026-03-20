//POST (Accept Suggestion)

import { NextResponse } from 'next/server';
import { Container } from '@/lib/container'
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST(
    req: Request,
    { params }: { params: Promise<{ "session-id": string }> }
) {
    try {
        // We expect the messageId in the body so we know WHICH suggestion to accept
        const { messageId } = await req.json();

        const chatService = Container.chatService

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        const { "session-id": sessionId } = await params;

        await chatService.acceptSuggestion(sessionId, messageId, supabase);

        return NextResponse.json({ success: true });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}