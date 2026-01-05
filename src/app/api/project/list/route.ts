import { NextResponse } from "next/server";
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from "@/app/api/utils";

//This is the API endpoint for the DashboardPage.tsx to fetch the projects for the current user.
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    // const userId = searchParams.get('userId'); 

    // Authenticate
    const { supabase, user } = await createAuthenticatedClient();
    
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = user.id;

    // 1. Get User Profile to retrieve organization_id
    // Pass the authenticated client to bypass RLS issues
    const userProfile = await Container.userService.getUserProfile(userId, supabase);
    if (!userProfile || !userProfile.organization_id) {
      return NextResponse.json(
        { error: "User profile not found or not linked to an organization." },
        { status: 404 }
      );
    }
    const orgId = userProfile.organization_id;

    // 2. Fetch Projects
    // Pass the authenticated client so we respect RLS
    const projects = await Container.projectRepo.getByOrgId(orgId, supabase);

    // 3. Map to Frontend Friendly Format if needed
    // The frontend expects: { id, name, reports, photos, status, lastUpdated }
    // We'll calculate mock counts for reports/photos for now as those tables aren't fully linked in this query yet
    const mappedProjects = projects.map(p => ({
        id: p.projectId,
        name: p.name,
        status: p.status === 'ACTIVE' ? 'Active' : p.status === 'COMPLETED' ? 'Completed' : 'Archived',
        lastUpdated: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        reports: 0, // Placeholder
        photos: 0,  // Placeholder
        description: p.jobInfo?.clientName ? `Client: ${p.jobInfo.clientName}` : undefined
    }));

    return NextResponse.json({ 
        success: true, 
        projects: mappedProjects 
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Fetch Projects Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

