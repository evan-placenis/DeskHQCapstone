import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { Project } from "@/backend/domain/core/project.types";
import { createAuthenticatedClient } from "@/app/api/utils";
import { v4 as uuidv4 } from "uuid";

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
        const projectIdFromBody = body.projectId as string | undefined;
        const createProject = body.createProject as { name?: string; clientName?: string; address?: string } | undefined;

        let projectId: string;

        if (createProject?.name) {
            const orgId = userProfile.organization_id;
            const resolvedUserId = userProfile.id;
            const newProjectId = uuidv4();
            const now = new Date();
            const newProject: Project = {
                projectId: newProjectId,
                organizationId: orgId,
                name: createProject.name,
                status: "ACTIVE",
                metadata: {
                    createdDate: now,
                    lastModifiedDate: now,
                    status: "ACTIVE",
                    createdByUserId: resolvedUserId,
                },
                jobInfo: {
                    clientName: createProject.clientName ?? "",
                    siteAddress: createProject.address ?? "",
                    parsedData: {},
                },
                createdAt: now,
                updatedAt: now,
                images: [],
                knowledgeItems: [],
            };
            await Container.projectRepo.save(newProject, supabase);
            projectId = newProjectId;
        } else if (projectIdFromBody) {
            projectId = projectIdFromBody;
        } else {
            return NextResponse.json(
                { error: "Provide projectId or createProject: { name, clientName?, address? }" },
                { status: 400 }
            );
        }

        const project = await Container.projectRepo.getById(projectId, supabase);
        if (!project || project.organizationId !== userProfile.organization_id) {
            return NextResponse.json(
                { error: "Project not found or access denied." },
                { status: 403 }
            );
        }

        const { data: session, error: fetchError } = await supabase
            .from("capture_sessions")
            .select("id, folder_name")
            .eq("id", sessionId)
            .single();

        if (fetchError || !session) {
            return NextResponse.json({ error: "Capture session not found" }, { status: 404 });
        }

        const { error: updateError } = await supabase
            .from("capture_sessions")
            .update({ project_id: projectId, status: "finalized" })
            .eq("id", sessionId);

        if (updateError) {
            console.error("❌ Capture session finalize error:", updateError);
            return NextResponse.json(
                { error: updateError.message || "Failed to finalize session" },
                { status: 500 }
            );
        }

        return NextResponse.json({
            sessionId,
            projectId,
            folderName: session.folder_name,
        }, { status: 200 });
    } catch (err: unknown) {
        console.error("❌ Capture session finalize:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to finalize session" },
            { status: 500 }
        );
    }
}
