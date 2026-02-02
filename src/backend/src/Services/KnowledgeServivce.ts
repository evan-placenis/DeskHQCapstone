// ... imports
import { DocumentStrategyFactory } from '../Document_Strategies/factory/DocumentFactory';
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { KnowledgeRepository } from '../domain/interfaces/KnowledgeRepository';
import { VectorStore } from '../domain/interfaces/VectorStore';
import { DocumentChunk, KnowledgeItem } from '../domain/knowledge/rag.types';

export class KnowledgeService {

    constructor(
        private repo: KnowledgeRepository,
        private vectorStore: VectorStore,
        private documentFactory: DocumentStrategyFactory, // Injected dependency
        private adminClient: SupabaseClient // Injected Admin Client for RAG operations
    ) { }

    public async processDocument(
        projectId: string,
        fileBuffer: Buffer,
        fileName: string,
        docType: string,
        client: SupabaseClient
    ): Promise<KnowledgeItem> {

        // 1. Get Organization Name for Namespace
        const orgNamespace = await this.repo.getOrgNamespace(projectId, client); //this should just be the project id?
        if (!orgNamespace) {
            console.error(`Organization namespace not found for project ${projectId}`);
            throw new Error("Organization namespace not found");
        }

        const kId = uuidv4();
        console.log(`Processing file: ${fileName} (${kId}) as ${docType} for Org: ${orgNamespace}`);

        // 2. GET STRATEGY 🧠
        // Use the injected factory instance
        const strategy = this.documentFactory.getStrategy(docType);

        // 3. DELEGATE WORK 👷
        // Extract text (HTML for Spec, Raw Text for Report)
        const extractedContent = await strategy.extractText(fileBuffer);

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
            // 5. PREPARE CHUNKS 
            const documentChunks: DocumentChunk[] = rawChunks.map((text) => ({
                chunkId: uuidv4(),
                kId: kId,
                textSegment: text,
                embeddingVector: [],
                metadata: {
                    pageNumber: 0,
                    sectionTitle: "General",
                    documentName: fileName,
                    projectId: projectId
                }
            }));

            // 6. SAVE TO PINECONE
            console.log(`🔍 [DEBUG] Generated ${documentChunks.length} chunks.`);

            await this.vectorStore.upsertChunks(documentChunks, orgNamespace);

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

        const orgNamespace = await this.repo.getOrgNamespace(doc.projectId, client);
        console.log(`Deleting document ${kId} from Org ${orgNamespace}`);

        // 2. Delete from Pinecone
        if (orgNamespace) {
            await this.vectorStore.deleteDocumentChunks(kId, orgNamespace);
        } else {
            console.warn(`Org Namespace missing for doc ${kId}, checking default namespace.`);
            await this.vectorStore.deleteDocumentChunks(kId);
        }

        // 3. Delete from Postgres
        await this.repo.delete(kId, client);
    }

    public async deleteProjectDocuments(projectId: string, client: SupabaseClient): Promise<void> {
        const orgNamespace = await this.repo.getOrgNamespace(projectId, client);
        console.log(`Deleting all documents for project ${projectId} from Org ${orgNamespace}`);

        // 1. Delete from Pinecone
        if (orgNamespace) {
            await this.vectorStore.deleteProjectChunks(projectId, orgNamespace);
        }

        // 2. Postgres deletion handled by cascade if project is deleted, 
        // or we can explicitly list and delete if needed. 
    }

    // --- NEW: SEARCH ---
    public async search(queries: string[], projectId: string): Promise<string[]> {
        const uniqueSpecs = new Set<string>();

        // Use projectId as namespace so search matches saveWebDataToDatabase (and doc uploads if aligned)
        const searchNamespace = projectId;
        if (!searchNamespace) {
            console.warn(`No projectId provided, skipping RAG search.`);
            return [];
        }

        console.log(`🔍 Searching Knowledge Base for Project ${projectId} (namespace: ${searchNamespace})`);

        for (const query of queries) {
            if (!query || query.trim() === "") continue;

            // Basic logic: Search for each description
            // Limit to top 2 results per image description to avoid context bloat
            try {
                const results = await this.vectorStore.similaritySearch(query, 2, searchNamespace);
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

        // 3. Format for your Vector Store
        // We leave embeddingVector empty [] as your store handles it
        const finalData = textSegments.map((segment, index) => ({
            chunkId: uuidv4(),
            kId: knowledgeId, // Shared ID for the whole document
            textSegment: segment,
            embeddingVector: [], // 👈 Empty, gets done in the upsertChunks function
            metadata: {
                pageNumber: 1,  //may want to change the records to be more general(not have a page number)
                sectionTitle: "Web Research",
                documentName: sourceUrl || "External Search",
                projectId: projectId,
                chunkIndex: index
            }
        }));

        // 4. Send to store
        if (finalData.length > 0) {
            // This function will presumably loop through finalData and 
            // call openai.embeddings.create for each item before saving
            await this.vectorStore.upsertChunks(finalData, projectId);
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
