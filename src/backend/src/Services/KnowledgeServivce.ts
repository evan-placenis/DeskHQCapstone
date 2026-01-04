// For Word: npm install mammoth
// For PDF: npm install pdf-parse

import { v4 as uuidv4 } from 'uuid';
import mammoth from 'mammoth'; // For Word
// 1. Change the import to use 'require' for the old PDF library
const pdf = require('pdf-parse');

// Domain Imports
import { KnowledgeRepository } from '../domain/interfaces/KnowledgeRepository';
import { VectorStore } from '../domain/interfaces/VectorStore';
import { KnowledgeItem, DocumentChunk } from '../domain/knowledge/rag.types';

export class KnowledgeService {
    
    // Dependencies
    constructor(
        private repo: KnowledgeRepository,
        private vectorStore: VectorStore
    ) {}

    /**
     * 🚀 MAIN ENTRY POINT: Process an uploaded file
     */
    public async processDocument(
        projectId: string,
        fileBuffer: Buffer,
        fileName: string,
        mimeType: 'application/pdf' | 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ): Promise<void> {
        
        const kId = uuidv4();
        console.log(`Processing file: ${fileName} (${kId})`);

        // 1. EXTRACT TEXT
        let extractedText = "";
        let docType: 'PDF' | 'WORD' = 'WORD';

        if (mimeType.includes('pdf')) {
            docType = 'PDF';
            const data = await pdf(fileBuffer);
            extractedText = data.text;
        } else if (mimeType.includes('word') || mimeType.includes('officedocument')) {
            docType = 'WORD'; // or 'DOCX'
            const result = await mammoth.extractRawText({ buffer: fileBuffer });
            extractedText = result.value;
        } else {
            throw new Error("Unsupported file type");
        }

        // 2. CREATE DOMAIN OBJECT (Metadata)
        const knowledgeItem: KnowledgeItem = {
            kId,
            projectId,
            documentType: docType,
            originalFileName: fileName,
            content: extractedText,
            status: 'PROCESSING',
            uploadedAt: new Date()
        };

        // Save metadata to Postgres immediately
        await this.repo.save(knowledgeItem);

        try {
            // 3. CHUNK THE TEXT (Split into smaller pieces)
            const rawChunks = this.splitTextIntoChunks(extractedText, 1000); // ~1000 chars per chunk

            // 4. PREPARE CHUNKS (Updated for Integrated Inference)
            // We no longer generate vectors here. We just prepare the text.
            const documentChunks: DocumentChunk[] = rawChunks.map((text) => ({
                chunkId: uuidv4(),
                kId: kId,
                textSegment: text,
                embeddingVector: [], // 👈 Empty! Pinecone will fill this in for us.
                metadata: {
                    pageNumber: 0, 
                    sectionTitle: "General"
                }
            }));

            // 5. SAVE TO PINECONE (The Store now handles embedding)
            console.log(`Sending ${documentChunks.length} text chunks to Pinecone...`);
            await this.vectorStore.upsertChunks(documentChunks);

            // 6. UPDATE STATUS
            await this.repo.updateStatus(kId, 'INDEXED');
            console.log(`✅ Document ${fileName} fully indexed!`);

        } catch (error) {
            console.error("Failed to process document:", error);
            await this.repo.updateStatus(kId, 'FAILED');
            throw error;
        }
    }

    /**
     * Helper: Simple chunker
     */
    private splitTextIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        let currentChunk = "";

        // Split by paragraphs (double newline) or periods to be safe
        const sentences = text.split(/(?<=[.?!])\s+/);

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize) {
                chunks.push(currentChunk);
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? " " : "") + sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk);
        
        return chunks;
    }
    
    public async getDocuments(projectId: string) {
        return await this.repo.listByProject(projectId);
    }
}