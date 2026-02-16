// This defines what a "Document" looks like before and after we chop it up for the AI.

// 1. The Source Document (e.g., a PDF spec sheet)
export interface KnowledgeItem {
    kId: string;
    projectId: string;
    documentType: 'DOCX';
    originalFileName: string;
    content: string;
    uploadedAt: Date;
    status: 'PROCESSING' | 'INDEXED' | 'FAILED';
}

/** Metadata stored with each vector chunk in Pinecone. Enables filtering by source_type (spec vs web). */
export interface VectorMetadata {
    projectId: string;
    source_type: 'spec_upload' | 'web_search';
    source_reference: string;   // Filename OR Web URL
    title: string;              // e.g. "Concrete Specs Part 1" OR "Weather Report - Toronto"
    chunkIndex: number;
    fetched_at: string;         // ISO Date (for cleaning stale web data)
}

// 2. The Chunk (A small piece of the document for the AI)
export interface DocumentChunk {
    chunkId: string;
    kId: string;
    textSegment: string;
    embeddingVector?: number[];
    metadata: VectorMetadata;
}
