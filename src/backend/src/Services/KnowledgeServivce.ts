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
        private documentFactory: DocumentStrategyFactory // Injected dependency
    ) {}

    public async processDocument(
        projectId: string, 
        fileBuffer: Buffer, 
        fileName: string, 
        docType: string, 
        client: SupabaseClient
    ): Promise<KnowledgeItem> {
        
        // 1. Get Organization Name for Namespace
        const orgNamespace = await this.repo.getOrgNamespace(projectId, client);
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
}
