// 🆕 NEW Chat Route using AI-SDK
// GET (History), POST (Send Message)
import { NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

// 1. SEND A MESSAGE (Talk to AI) - Returns streaming response
export async function POST(
    req: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const body = await req.json();
        const { message, activeSectionId, reportId, provider = 'grok' } = body;
        const { sessionId } = await params;

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use ChatServiceNew from Container (singleton)
        const aiResponse = await Container.chatService.handleUserMessage(
            sessionId,
            message,
            supabase,
            activeSectionId,
            reportId,
            provider
        );

        return NextResponse.json(aiResponse);
    } catch (error: any) {
        console.error("❌ API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
