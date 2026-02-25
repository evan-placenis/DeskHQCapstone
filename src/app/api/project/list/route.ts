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

    // 3. Get counts for each project
    const projectIds = projects.map(p => p.projectId);
    
    // Count reports per project
    const { data: reportCounts } = await supabase
      .from('reports')
      .select('project_id')
      .in('project_id', projectIds);
    
    const reportsByProject = (reportCounts || []).reduce((acc: Record<string, number>, report: any) => {
      acc[report.project_id] = (acc[report.project_id] || 0) + 1;
      return acc;
    }, {});

    // Count photos per project
    const { data: photoCounts } = await supabase
      .from('project_images')
      .select('project_id')
      .in('project_id', projectIds);
    
    const photosByProject = (photoCounts || []).reduce((acc: Record<string, number>, photo: any) => {
      acc[photo.project_id] = (acc[photo.project_id] || 0) + 1;
      return acc;
    }, {});

    // Count knowledge/spec documents per project
    const { data: docCounts } = await supabase
      .from('knowledge_items')
      .select('project_id')
      .in('project_id', projectIds);
    
    const documentsByProject = (docCounts || []).reduce((acc: Record<string, number>, doc: any) => {
      acc[doc.project_id] = (acc[doc.project_id] || 0) + 1;
      return acc;
    }, {});

    // 4. Map to Frontend Friendly Format
    // The frontend expects: { id, name, reports, photos, documents, status, lastUpdated }
    const mappedProjects = projects.map(p => ({
        id: p.projectId,
        name: p.name,
        status: p.status === 'ACTIVE' ? 'Active' : p.status === 'COMPLETED' ? 'Completed' : 'Archived',
        lastUpdated: p.updatedAt ? new Date(p.updatedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        reports: reportsByProject[p.projectId] || 0,
        photos: photosByProject[p.projectId] || 0,
        documents: documentsByProject[p.projectId] || 0,
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

