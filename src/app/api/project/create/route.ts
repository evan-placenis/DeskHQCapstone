import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { Project } from '@/backend/domain/core/project.types';
import { v4 as uuidv4 } from 'uuid';
import { createAuthenticatedClient } from "@/app/api/utils";

//This is the API endpoint for the DashboardPage.tsx to create a new project for the current user.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const { name, clientName, address } = body; 

    if (!name) {
        return NextResponse.json({ error: "Project Name is required" }, { status: 400 });
    }

    // Authenticate user
    const { supabase, user } = await createAuthenticatedClient();
    
    if (!user) {
        console.error("❌ Auth Error: No valid session found in project/create route.");
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // 1. Resolve User & Org
    // We use the userService to get the full profile including organization_id, passing the authenticated client
    const userProfile = await Container.userService.getUserProfile(userId, supabase); 
    
    // If no user found (or invalid ID provided), we can't create a project linked to an org
    if (!userProfile || !userProfile.organization_id) {
        return NextResponse.json({ 
            error: "User not found or not linked to an organization. Please register first." 
        }, { status: 404 });
    }

    const orgId = userProfile.organization_id;
    const resolvedUserId = userProfile.id;

    console.log(`✅ User resolved: ${resolvedUserId} (Org: ${orgId})`);

    // 2. Construct Project Object
    const newProjectId = uuidv4();
    const now = new Date();

    const newProject: Project = {
        projectId: newProjectId,
        organizationId: orgId, 
        name: name,
        status: 'ACTIVE',
        metadata: {
            createdDate: now,
            lastModifiedDate: now,
            status: 'ACTIVE',
            createdByUserId: resolvedUserId
        },
        jobInfo: {
            clientName: clientName || "",
            siteAddress: address || "",
            parsedData: {}
        },
        createdAt: now,
        updatedAt: now,
        images: [],
        knowledgeItems: []
    };

    // 3. Save
    console.log(`⚙️ Service: Saving Project "${name}"...`);
    // Pass the authenticated client so we respect RLS and created_by user context
    await Container.projectRepo.save(newProject, supabase);

    return NextResponse.json({ 
        success: true, 
        project: {
            id: newProjectId,
            name: newProject.name,
            status: newProject.status,
            client: newProject.jobInfo.clientName,
            address: newProject.jobInfo.siteAddress
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
