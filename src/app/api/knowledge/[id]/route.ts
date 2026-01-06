import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from '@/app/api/utils';
//This is the route for deleting a document from the pinecone knowledge base
export async function DELETE(
    request: NextRequest,
    context: { params: Promise<{ id: string }> } // Use Promise as per Next.js 15+ changes
) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { id } = await context.params; // Await params

        if (!id) {
            return NextResponse.json({ error: "Missing document ID" }, { status: 400 });
        }

        await Container.knowledgeService.deleteDocument(id, supabase); //delete the document from the pinecone knowledge base and supabase

        return NextResponse.json({ success: true, message: "Document deleted successfully" });
    } catch (error: any) {
        console.error("Delete knowledge error:", error);
        return NextResponse.json({ error: error.message || "Failed to delete document" }, { status: 500 });
    }
}

