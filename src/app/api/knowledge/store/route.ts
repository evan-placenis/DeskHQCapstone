import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from '@/app/api/utils';

export async function POST(request: NextRequest) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const formData = await request.formData();
        const file = formData.get('file') as File;
        const projectId = formData.get('projectId') as string;
        const documentType = formData.get('type') as string; // Get the doc type from frontend

        if (!file || !projectId) {
            return NextResponse.json({ error: "Missing file or projectId" }, { status: 400 });
        }

        // Validate file type (User said they are always working with docx)
        if (!file.name.endsWith('.docx') && !file.name.endsWith('.doc')) {
             return NextResponse.json({ error: "Only .docx files are supported as per current configuration" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        
        const document = await Container.knowledgeService.processDocument(
            projectId,
            buffer,
            file.name,
            documentType || 'specification', // Default to specification if missing
            supabase
        );

        return NextResponse.json({ success: true, message: "Document processed successfully", document: {
            id: document.kId,
            name: document.originalFileName,
            type: (document.documentType || 'DOCX').toLowerCase(),
            description: "",
            uploadDate: document.uploadedAt.toISOString(),
            fileSize: "Unknown", 
            fileType: document.originalFileName.split('.').pop()?.toUpperCase() || 'DOCX'
        }});
    } catch (error: any) {
        console.error("Knowledge upload error:", error);
        return NextResponse.json({ error: error.message || "Failed to process document" }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const projectId = searchParams.get('projectId');

        if (!projectId) {
            return NextResponse.json({ error: "Missing projectId" }, { status: 400 });
        }

        const documents = await Container.knowledgeService.getDocuments(projectId, supabase);

        return NextResponse.json({ success: true, documents });
    } catch (error: any) {
        console.error("Fetch knowledge error:", error);
        return NextResponse.json({ error: error.message || "Failed to fetch documents" }, { status: 500 });
    }
}
