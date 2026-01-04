// GET (History), POST (Send Message)
import { NextResponse } from 'next/server';
import {Container} from '@/backend/config/container'

// 1. SEND A MESSAGE (Talk to AI)
export async function POST(
    req: Request, 
    { params }: { params: { sessionId: string } }
) {
    try {
        const { message } = await req.json(); // { message: "Fix the intro" }
        const chatService = Container.chatService

        // This performs the full loop: Save User -> Call AI -> Save AI -> Return AI Msg
        const aiResponse = await chatService.handleUserMessage(params.sessionId, message);

        return NextResponse.json(aiResponse);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 2. GET CHAT HISTORY
export async function GET(
    req: Request,
    { params }: { params: { sessionId: string } }
) {
    try {
        const chatService = Container.chatService
        
        // Again, assuming repo access. 
        // Ideally, ChatService should have a `getHistory(id)` method to wrap this.
        const session = await (chatService as any).repo.getSessionById(params.sessionId);

        if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });

        return NextResponse.json(session);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}