import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { Project } from '@/backend/domain/core/project.types';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // In a real app, you'd get the USER ID from the Session/JWT
    // For this prototype, we'll accept a 'userId' in the body or header for testing
    // OR we default to a specific user if known.
    
    const { name, clientName, address, userId } = body; 

    if (!name) {
        return NextResponse.json({ error: "Project Name is required" }, { status: 400 });
    }

    if (!userId) {
         // Fallback for testing ONLY: Fetch the first admin user we can find
         // In production, this would be an error: "Unauthorized"
         console.warn("⚠️ No userId provided. Attempting to resolve a default user...");
    }

    // 1. Resolve User & Org
    // We use the userService to get the full profile including organization_id
    const userProfile = await Container.userService.getUserProfile(userId || '00000000-0000-0000-0000-000000000000'); 
    
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
    await Container.projectRepo.save(newProject);

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
