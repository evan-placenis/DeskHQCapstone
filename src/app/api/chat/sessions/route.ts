//GET (List), POST (Create New)
import { NextResponse } from 'next/server';
import {Container} from '@/backend/config/container'

// 1. CREATE A NEW SESSION
export async function POST(req: Request) {
    try {
        const { userId, projectId, reportId } = await req.json();
        const chatService = Container.chatService

        const session = await chatService.startSession(userId, projectId, reportId);
        
        return NextResponse.json(session);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

// 2. LIST ALL SESSIONS FOR A PROJECT
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        
        if (!projectId) return NextResponse.json({ error: "Project ID required" }, { status: 400 });

        const chatService = Container.chatService
        // Accessing repo directly here is fine for simple reads, 
        // or you can add a wrapper method in ChatService if you prefer strict layering.
        // Assuming you made repo public or added a getter:
        const sessions = await (chatService as any).repo.getSessionsByProject(projectId);

        return NextResponse.json(sessions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}