//GET (List), POST (Create New)
import { NextResponse } from 'next/server';
import { Container } from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

// 1. CREATE OR GET SESSION (find-or-create by reportId so we reuse the session the trigger created)
export async function POST(req: Request) {
    try {
        const { projectId, reportId } = await req.json();

        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 });
        }

        // If opening a report: reuse existing session if the trigger already created one (with "Report Complete" message)
        if (reportId) {
            const existing = await Container.chatRepo.getSessionByReportId(reportId, supabase);
            if (existing) {
                return NextResponse.json(existing);
            }
        }

        // No existing session for this report: create new one
        const session = await Container.chatService.startSession(user.id, projectId, supabase, reportId);
        // Return full session with messages (empty for new) so frontend always gets same shape
        const fullSession = await Container.chatRepo.getSessionById(session.sessionId, supabase);
        return NextResponse.json(fullSession ?? session);
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
