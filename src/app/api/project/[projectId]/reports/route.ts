import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
// this is the route for getting all reports for a project
export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
        
        // Authenticate
        const { user, supabase } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const reportService = Container.reportService;
        const reports = await reportService.getReportsByProject(projectId, supabase);

        return NextResponse.json({ reports });

    } catch (error: any) {
        console.error("Get Project Reports Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch reports" },
            { status: 500 }
        );
    }
}

