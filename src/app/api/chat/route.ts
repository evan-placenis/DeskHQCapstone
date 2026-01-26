//GET (List), POST (Create New)
import { NextResponse } from 'next/server';
import { Container } from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

// 1. CREATE A NEW SESSION
export async function POST(req: Request) {
    try {
        const { projectId, reportId } = await req.json();

        // Authenticate first to get user
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 });
        }

        // Use ChatServiceNew from Container (singleton)
        const session = await Container.chatServiceNew.startSession(user.id, projectId, supabase, reportId);

        // Return session with sessionId (session already contains sessionId, so no need to duplicate)
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

        // Authenticate
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use repo directly to avoid initializing old system
        const sessions = await Container.chatRepo.getSessionsByProject(projectId, supabase);

        return NextResponse.json(sessions);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
