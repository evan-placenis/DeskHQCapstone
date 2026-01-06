import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from '@/app/api/utils';
//This is the route for deleting a project and all associated documents in the pinecone knowledge base
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ projectId: string }> }
) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { projectId } = await context.params;

        if (!projectId) {
            return NextResponse.json({ error: "Missing project ID" }, { status: 400 });
        }

        // 1. Delete associated vectors (Knowledge Base)
        // This keeps Pinecone clean.
        await Container.knowledgeService.deleteProjectDocuments(projectId, supabase);

        // 2. Delete the Project from DB
        // (Cascading deletes in DB should handle related rows like Reports, but vectors are external)
        await Container.projectRepo.delete(projectId, supabase);

        return NextResponse.json({ success: true, message: "Project and associated data deleted successfully" });
    } catch (error: any) {
        console.error("Delete project error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete project" }, { status: 500 });
    }
}

