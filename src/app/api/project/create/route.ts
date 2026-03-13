import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, clientName, address } = body;

    if (!name) {
        return NextResponse.json({ error: "Project Name is required" }, { status: 400 });
    }

    const { supabase, user } = await createAuthenticatedClient();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userProfile = await Container.userService.getUserProfile(user.id, supabase);
    if (!userProfile || !userProfile.organization_id) {
        return NextResponse.json({
            error: "User not found or not linked to an organization. Please register first."
        }, { status: 404 });
    }

    const newProject = await Container.projectService.createProject({
        name,
        clientName: clientName || "",
        address: address || "",
        orgId: userProfile.organization_id,
        userId: userProfile.id,
    }, supabase);

    return NextResponse.json({
        success: true,
        project: {
            id: newProject.projectId,
            name: newProject.name,
            status: newProject.status,
            client: newProject.jobInfo.clientName,
            address: newProject.jobInfo.siteAddress,
        }
    }, { status: 201 });

  } catch (error: any) {
    console.error("❌ Create Project Route Error:", error);
    return NextResponse.json(
        { error: error.message || "Failed to create project" },
        { status: 500 }
    );
  }
}
