// ... imports
import { DocumentStrategyFactory } from '../Document_Strategies/factory/DocumentFactory';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeRepository } from '../domain/interfaces/KnowledgeRepository';
import { VectorStore } from '../domain/interfaces/VectorStore';
import { DocumentChunk, KnowledgeItem, VectorMetadata } from '../domain/knowledge/rag.types';
import { StorageService } from './StorageService';
import { file } from 'zod';

export type { VectorMetadata } from '../domain/knowledge/rag.types';

export class KnowledgeService {

    constructor(
        private repo: KnowledgeRepository,
        private vectorStore: VectorStore,
        private documentFactory: DocumentStrategyFactory, // Injected dependency
        private adminClient: SupabaseClient, // Injected Admin Client for RAG operations
        private storageService: StorageService
    ) { }

    public async processDocument(
        projectId: string,
        fileBuffer: Buffer,
        fileName: string,
        docType: string,
        client: SupabaseClient
    ): Promise<KnowledgeItem> {

        const organizationId = await this.repo.getOrgId(projectId, client);
        const projectNamespace = await this.repo.getProjectNamespace(projectId, client);
        if (!projectNamespace) {
            console.error(`Project namespace not found for project ${projectId}`);
            throw new Error("Project namespace not found");
        }

        const kId = uuidv4();
        console.log(`Processing file: ${fileName} (${kId}) as ${docType} for namespace: ${projectNamespace}`);

        // 2. GET STRATEGY 🧠
        // Use the injected factory instance
        const strategy = this.documentFactory.getStrategy(docType);

        // 3. DELEGATE WORK 👷
        // Extract text (HTML for Spec, Raw Text for Report); pass client and kId so spec images are linked for cascade delete
        const extractedContent = await strategy.extractText(fileBuffer, projectId, organizationId, client, kId, fileName);

        // Chunk the content
        const rawChunks = strategy.chunkText(extractedContent);

        // 4. CREATE DOMAIN OBJECT (Metadata)
        const knowledgeItem: KnowledgeItem = {
            kId,
            projectId,
            documentType: 'DOCX', // User assumed always Docx
            originalFileName: fileName,
            content: extractedContent,
            status: 'PROCESSING',
            uploadedAt: new Date()
        };

        // Save metadata to Postgres immediately
        await this.repo.save(knowledgeItem, client);

        try {
            const fetchedAt = new Date().toISOString();
            const documentChunks: DocumentChunk[] = rawChunks.map((text, index) => ({
                chunkId: uuidv4(),
                kId: kId,
                textSegment: text,
                embeddingVector: [],
                metadata: {
                    projectId,
                    source_type: 'spec_upload',
                    source_reference: fileName,
                    title: fileName,
                    chunkIndex: index,
                    fetched_at: fetchedAt,
                } satisfies VectorMetadata,
            }));

            // 6. SAVE TO PINECONE (namespace = projectName/projectId)
            console.log(`🔍 [DEBUG] Generated ${documentChunks.length} chunks.`);
            await this.vectorStore.upsertChunks(documentChunks, projectNamespace);

            // 7. UPDATE STATUS
            await this.repo.updateStatus(kId, 'INDEXED', client);

            return knowledgeItem;

        } catch (error) {
            console.error("Failed to process document:", error);
            await this.repo.updateStatus(kId, 'FAILED', client);
            throw error;
        }
    }

    public async getDocuments(projectId: string, client: SupabaseClient) {
        return await this.repo.listByProject(projectId, client);
    }

    public async deleteDocument(kId: string, client: SupabaseClient): Promise<void> {
        // 1. Get document metadata to find Project -> Org
        const doc = await this.repo.getById(kId, client);
        if (!doc) {
            console.warn(`Document ${kId} not found, skipping delete.`);
            return;
        }

        const projectNamespace = await this.repo.getProjectNamespace(doc.projectId, client);
        console.log(`Deleting document ${kId} from namespace ${projectNamespace}`);

        if (projectNamespace) {
            await this.vectorStore.deleteDocumentChunks(kId, projectNamespace);
        } else {
            console.warn(`Project namespace missing for doc ${kId}, checking default namespace.`);
            await this.vectorStore.deleteDocumentChunks(kId);
        }

        // 3. Delete spec images (DB rows + storage files) linked to this document
        await this.storageService.deleteSpecImagesByKnowledgeId(kId, client);

        // 4. Delete from Postgres
        await this.repo.delete(kId, client);
    }

    public async deleteProjectDocuments(projectId: string, client: SupabaseClient): Promise<void> {
        const projectNamespace = await this.repo.getProjectNamespace(projectId, client);
        console.log(`Deleting all documents for project ${projectId} from namespace ${projectNamespace}`);

        if (projectNamespace) {
            await this.vectorStore.deleteProjectChunks(projectId, projectNamespace);
        }

        // 2. Postgres deletion handled by cascade if project is deleted, 
        // or we can explicitly list and delete if needed. 
    }

    // --- NEW: SEARCH ---
    public async search(queries: string[], projectId: string, client?: SupabaseClient): Promise<string[]> {
        const uniqueSpecs = new Set<string>();
        const supabase = client ?? this.adminClient;

        const projectNamespace = await this.repo.getProjectNamespace(projectId, supabase);
        if (!projectNamespace) {
            console.warn(`No project namespace for projectId ${projectId}, skipping RAG search.`);
            return [];
        }

        console.log(`🔍 Searching Knowledge Base for Project ${projectId} (namespace: ${projectNamespace})`);

        for (const query of queries) {
            if (!query || query.trim() === "") continue;

            // Basic logic: Search for each description
            // Limit to top 2 results per image description to avoid context bloat
            try {
                const results = await this.vectorStore.similaritySearch(query, 2, projectNamespace);
                results.forEach(doc => {
                    uniqueSpecs.add(doc.textSegment);
                });
            } catch (err) {
                console.error(`Error searching for query "${query}":`, err);
            }
        }

        return Array.from(uniqueSpecs);
    }

    public async saveWebDataToDatabase(webData: string, sourceUrl: string, projectId: string): Promise<void> {

        // 1. Chunking: Split the massive string
        // 2000 chars is a good default for most embedding models
        const textSegments = this.splitTextOptimized(webData, 2000, 200);

        // 2. Generate a Shared Knowledge ID (kId) 
        // This groups all chunks from this ONE search result together
        const knowledgeId = uuidv4();

        const fetchedAt = new Date().toISOString();
        const webTitle = sourceUrl ? new URL(sourceUrl).hostname : "Web Search";
        const finalData: DocumentChunk[] = textSegments.map((segment, index) => ({
            chunkId: uuidv4(),
            kId: knowledgeId,
            textSegment: segment,
            embeddingVector: [],
            metadata: {
                projectId,
                source_type: 'web_search',
                source_reference: sourceUrl || "unknown",
                title: webTitle,
                chunkIndex: index,
                fetched_at: fetchedAt,
            } satisfies VectorMetadata,
        }));

        // 4. Send to store (same namespace as doc uploads: projectName/projectId)
        if (finalData.length > 0) {
            const projectNamespace = await this.repo.getProjectNamespace(projectId, this.adminClient);
            await this.vectorStore.upsertChunks(finalData, projectNamespace || projectId);
        }
    }


    /**
     * 🛠️ Helper: Splits text intelligently without cutting words in half.
     * @param text The full string
     * @param chunkSize Max characters per chunk
     * @param overlap How many chars to repeat (helps AI keep context across chunks)
     */
    private splitTextOptimized(text: string, chunkSize: number, overlap: number): string[] {
        const chunks: string[] = [];
        let startIndex = 0;

        while (startIndex < text.length) {
            let endIndex = startIndex + chunkSize;

            // If we are not at the end of the text, try to find a natural break point (space or period)
            // so we don't slice a word like "Construc|tion"
            if (endIndex < text.length) {
                // Look for the last space within the chunk limit
                const lastSpace = text.lastIndexOf(' ', endIndex);

                // If found and it's not too far back, use it
                if (lastSpace > startIndex) {
                    endIndex = lastSpace;
                }
            }

            const chunk = text.slice(startIndex, endIndex).trim();
            if (chunk.length > 0) chunks.push(chunk);

            // Move forward, but back up by 'overlap' amount to keep context
            startIndex = endIndex - overlap;

            // Avoid infinite loops if overlap >= chunk size (sanity check)
            if (startIndex < 0) startIndex = 0;
        }

        return chunks;
    }
}
