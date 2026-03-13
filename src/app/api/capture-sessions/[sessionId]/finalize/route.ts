import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { ServiceError } from "@/backend/Services/CaptureService";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const userProfile = await Container.userService.getUserProfile(user.id, supabase);
        if (!userProfile || !userProfile.organization_id) {
            return NextResponse.json(
                { error: "User profile not found or not linked to an organization." },
                { status: 403 }
            );
        }

        const body = await request.json().catch(() => ({}));

        const result = await Container.captureSessionService.finalizeSession(
            sessionId,
            {
                projectId: body.projectId,
                createProject: body.createProject,
            },
            userProfile.organization_id,
            userProfile.id,
            supabase
        );

        return NextResponse.json(result, { status: 200 });
    } catch (err: unknown) {
        console.error("❌ Capture session finalize:", err);
        const message = err instanceof Error ? err.message : "Failed to finalize session";
        const status = err instanceof ServiceError ? err.statusCode : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
