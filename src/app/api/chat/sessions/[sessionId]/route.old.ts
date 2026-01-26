// GET (History), POST (Send Message)
import { NextResponse } from 'next/server';
import {Container} from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

// 1. SEND A MESSAGE (Talk to AI)
export async function POST(
    req: Request, 
    { params }: { params: Promise<{ sessionId: string }> } // 🟢 Fix for Next.js 15
) {
    try {
        const body = await req.json();
        const { message, activeSectionId, reportId } = body; // 🟢 Accept reportId in message body
        const { sessionId } = await params;

        // console.log(`📨 API POST /chat/sessions/${sessionId}`);
        // console.log(`📦 Body:`, { message, activeSectionId, reportId });

        const chatService = Container.chatService

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // This performs the full loop: Save User -> Call AI -> Save AI -> Return AI Msg
        const aiResponse = await chatService.handleUserMessage(sessionId, message, supabase, activeSectionId, reportId); 

        return NextResponse.json(aiResponse);
    } catch (error: any) {
        console.error("❌ API Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 2. GET CHAT HISTORY
export async function GET(
    req: Request,
    { params }: { params: Promise<{ sessionId: string }> } // 🟢 Fix for Next.js 15
) {
    try {
        const chatService = Container.chatService
        const { sessionId } = await params;
        
        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }
        
        // Again, assuming repo access. 
        // Ideally, ChatService should have a `getHistory(id)` method to wrap this.
        const session = await (chatService as any).repo.getSessionById(sessionId, supabase);

        if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json(session);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
