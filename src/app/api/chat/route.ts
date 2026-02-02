//GET (List), POST (Create New)
import { NextResponse } from 'next/server';
import { Container } from '@/backend/config/container'
import { createAuthenticatedClient } from "@/app/api/utils";

// 1. CREATE OR GET SESSION (find-or-create by reportId so we reuse the session the trigger created)
export async function POST(req: Request) {
    let body: { projectId?: unknown; reportId?: unknown; message?: unknown };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    //ensure the projectId and reportId are strings
    const rawProjectId = body?.projectId;
    const rawReportId = body?.reportId;
    const projectId = rawProjectId != null && rawProjectId !== '' ? String(rawProjectId) : undefined;
    const reportId = rawReportId != null && rawReportId !== '' ? String(rawReportId) : undefined;

    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        if (!projectId) {
            return NextResponse.json({ error: "Project ID required" }, { status: 400 });
        }

        // 1. Try to find existing session first (optimization + avoid duplicate)
        if (reportId) {
            const existing = await Container.chatRepo.getSessionByReportId(reportId, supabase);
            if (existing) {
                return NextResponse.json(existing);
            }
        }

        // 2. Not found: try to create one (no session yet for this report is normal)
        try {
            const newSession = await Container.chatService.startSession(user.id, projectId, supabase, reportId ?? undefined);
            const fullSession = await Container.chatRepo.getSessionById(newSession.sessionId, supabase);
            return NextResponse.json(fullSession ?? newSession);
        } catch (createError: any) {
            // Optimistic concurrency: if DB raises unique constraint, another request created the session — return it
            const msg = createError?.message ?? '';
            const code = createError?.code;
            const isDuplicate =
                code === '23505' ||
                msg.includes('23505') ||
                msg.includes('unique_report_session') ||
                msg.toLowerCase().includes('unique constraint');

            if (isDuplicate && reportId) {
                const session = await Container.chatRepo.getSessionByReportId(reportId, supabase);
                if (session) {
                    return NextResponse.json(session);
                }
            }
            const errMsg = createError?.message ?? 'Create session failed';
            console.error("[POST /api/chat] Create session failed:", errMsg);
            return NextResponse.json({ error: errMsg }, { status: 500 });
        }
    } catch (error: any) {
        const errMsg = error?.message ?? "Internal server error";
        console.error("[POST /api/chat] Error:", errMsg);
        return NextResponse.json({ error: errMsg }, { status: 500 });
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
