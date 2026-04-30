import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ "project-id": string }> }
) {
    try {
        const { "project-id": projectId } = await params;
        const { searchParams } = new URL(request.url);
        const folderName = searchParams.get("folderName");

        if (!folderName) {
            return NextResponse.json(
                { error: "folderName query parameter is required" },
                { status: 400 }
            );
        }

        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const profile = await Container.userService.getUserProfile(user.id, supabase);
        if (!profile?.organization_id) {
            return NextResponse.json(
                { error: "Organization not found for user" },
                { status: 403 }
            );
        }

        const project = await Container.projectService.getById(projectId, supabase);
        if (!project) {
            return NextResponse.json({ error: "Project not found" }, { status: 404 });
        }
        if (project.organizationId !== profile.organization_id) {
            return NextResponse.json({ error: "Forbidden" }, { status: 403 });
        }

        const result = await Container.captureSessionService.getAudioTimeline(
            projectId,
            folderName,
            supabase,
            Container.adminClient,
        );

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("Audio timeline fetch error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch audio timeline data" },
            { status: 500 }
        );
    }
}
