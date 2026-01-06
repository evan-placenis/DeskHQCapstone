//This defines what a "Document" looks like before and after we chop it up for the AI.

// 1. The Source Document (e.g., a PDF spec sheet)
export interface KnowledgeItem {
    kId: string;             // UUID
    projectId: string;       // Belongs to a specific project
    documentType: 'DOCX';
    originalFileName: string;
    content: string;         // The full extracted text
    uploadedAt: Date;
    status: 'PROCESSING' | 'INDEXED' | 'FAILED';
}

// 2. The Chunk (A small piece of the document for the AI)
// We search for these "chunks" using math (vectors)
export interface DocumentChunk {
    chunkId: string;
    kId: string;             // Links back to the parent KnowledgeItem
    textSegment: string;     // The actual text (e.g., "Concrete strength must be 4000psi")
    
    // The "Embedding" - A list of numbers representing the meaning
    // (e.g., [0.12, -0.98, 0.44...])
    embeddingVector?: number[]; 
    
    metadata: {
        documentName: string;
        projectId: string;
        pageNumber: number;
        sectionTitle?: string;
    };
}