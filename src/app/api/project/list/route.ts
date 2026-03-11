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

    // 3b. Fetch draft reports across all projects (single query, sorted by most recent)
    const projectIdToName = Object.fromEntries(projects.map(p => [p.projectId, p.name]));
    let draftReports: Array<{ id: string; title: string; project: string; projectId: string; date: string; status: string; inspector: string; reviewer: string }> = [];
    if (projectIds.length > 0) {
      const { data: draftReportRows } = await supabase
        .from('reports')
        .select('id, project_id, title, status, updated_at, created_by')
        .in('project_id', projectIds)
        .ilike('status', 'draft')
        .order('updated_at', { ascending: false })
        .limit(6);

      draftReports = (draftReportRows || []).map((r: any) => ({
      id: r.id,
      title: r.title || 'Untitled Report',
      project: projectIdToName[r.project_id] || 'Unknown Project',
      projectId: r.project_id,
      date: r.updated_at ? new Date(r.updated_at).toISOString().split('T')[0] : '',
      status: 'Draft',
      inspector: 'Current User',
      reviewer: 'Pending',
    }));
    }

    // 3c. Fetch pending peer reviews assigned to current user (from report_review_requests)
    let peerReviews: Array<{
      id: string;
      reportId: string;
      reportTitle: string;
      projectName: string;
      requestedById: string;
      requestedByName: string;
      assignedToId: string;
      assignedToName: string;
      status: string;
      requestDate: string;
      requestNotes?: string;
      comments: never[];
    }> = [];
    try {
      const { data: reviewRows, error: reviewError } = await supabase
        .from("report_review_requests")
        .select("id, report_id, project_id, request_notes, request_date, requested_by, assigned_to")
        .eq("assigned_to", userId)
        .eq("status", "pending")
        .order("request_date", { ascending: false });

      if (reviewError) throw reviewError;

      if (reviewRows && reviewRows.length > 0) {
        const reportIds = [...new Set(reviewRows.map((r: any) => r.report_id))];
        const projectIdsForReviews = [...new Set(reviewRows.map((r: any) => r.project_id))];
        const requesterIds = [...new Set(reviewRows.map((r: any) => r.requested_by))];

        const [reportsRes, projectsRes, requestersRes] = await Promise.all([
          supabase.from("reports").select("id, title").in("id", reportIds),
          supabase.from("projects").select("id, name").in("id", projectIdsForReviews),
          supabase.from("profiles").select("id, full_name").in("id", requesterIds),
        ]);

        const reportTitles = Object.fromEntries((reportsRes.data || []).map((r: any) => [r.id, r.title || "Untitled"]));
        const projectNames = Object.fromEntries((projectsRes.data || []).map((p: any) => [p.id, p.name || "Unknown"]));
        const requesterNames = Object.fromEntries((requestersRes.data || []).map((p: any) => [p.id, p.full_name || "Unknown"]));

        peerReviews = reviewRows.map((r: any) => ({
          id: r.id,
          reportId: r.report_id,
          reportTitle: reportTitles[r.report_id] || "Untitled Report",
          projectName: projectNames[r.project_id] || "Unknown Project",
          requestedById: r.requested_by,
          requestedByName: requesterNames[r.requested_by] || "Unknown",
          assignedToId: r.assigned_to,
          assignedToName: userProfile.full_name || "You",
          status: "pending",
          requestDate: r.request_date ? new Date(r.request_date).toISOString().split("T")[0] : "",
          requestNotes: r.request_notes || undefined,
          comments: [],
        }));
      }
    } catch (e) {
      console.warn("report_review_requests table may not exist yet. Run migration.", e);
    }

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
        projects: mappedProjects,
        draftReports,
        peerReviews,
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Fetch Projects Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch projects" },
      { status: 500 }
    );
  }
}

