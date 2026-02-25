//Prerequisites: You would typically run npm install @pinecone-database/pinecone

//hen we save the vector, we also save the Text Segment inside Pinecone's metadata. This makes retrieval super fast—we get the "numbers" and the "text" back in a single call, so we don't have to look up the text in Postgres again

import { Pinecone } from '@pinecone-database/pinecone';
import dotenv from 'dotenv'
dotenv.config();
import { VectorStore } from '../../domain/interfaces/VectorStore';
import { DocumentChunk } from '../../domain/knowledge/rag.types';

export class PineconeVectorStore implements VectorStore {

    private client: Pinecone;
    private indexName: string;

    // We hardcode the model name you selected in the console
    private modelName = "llama-text-embed-v2";
    constructor() {
        if (!process.env.PINECONE_API_KEY) {
            throw new Error("Missing PINECONE_API_KEY");
        }

        // Initialize Pinecone with API Key from Env
        this.client = new Pinecone({ apiKey: process.env.PINECONE_API_KEY! });
        this.indexName = process.env.PINECONE_INDEX_NAME || 'capstone-docs';
    }

    /** Max texts per embed request for llama-text-embed-v2 (Pinecone batch limit). */
    private static readonly EMBED_BATCH_SIZE = 96;

    /**
     * Takes raw text, asks Pinecone to embed it, then saves it.
     * Batches embed calls to respect Pinecone's 96-input limit per request.
     * @param namespace - Typically "projectName/projectId" from KnowledgeRepository.getProjectNamespace
     */
    // --- 1. UPSERT (Save Text -> Pinecone Embeds It -> Save Vectors) ---
    async upsertChunks(chunks: DocumentChunk[], namespace?: string): Promise<void> {
        const index = this.client.index(this.indexName);
        const textToEmbed = chunks.map(c => c.textSegment);

        // Batch embed calls (Pinecone llama-text-embed-v2 allows max 96 inputs per request)
        const allValues: number[][] = [];
        for (let i = 0; i < textToEmbed.length; i += PineconeVectorStore.EMBED_BATCH_SIZE) {
            const batch = textToEmbed.slice(i, i + PineconeVectorStore.EMBED_BATCH_SIZE);
            const embeddings = await this.client.inference.embed(
                this.modelName,
                batch,
                { inputType: 'passage', truncate: 'END' }
            );
            for (let j = 0; j < (embeddings.data?.length ?? 0); j++) {
                allValues.push((embeddings.data![j] as any).values);
            }
        }

        const targetIndex = namespace ? index.namespace(namespace) : index;

        const records = chunks.map((chunk, i) => ({
            id: chunk.chunkId,
            values: allValues[i],
            metadata: {
                kId: chunk.kId,
                text: chunk.textSegment,
                projectId: chunk.metadata.projectId,
                source_type: chunk.metadata.source_type,
                source_reference: chunk.metadata.source_reference,
                title: chunk.metadata.title,
                chunkIndex: chunk.metadata.chunkIndex,
                fetched_at: chunk.metadata.fetched_at,
            }
        }));

        await targetIndex.upsert(records);
        console.log(`✅ Pinecone: Upserted ${chunks.length} chunks via Inference API (Namespace: ${namespace || 'default'}).`);
    }

    // --- 2. SEARCH (Query Text -> Pinecone Embeds It -> Retrieve Context) ---
    async similaritySearch(query: string, limit: number, namespace?: string, filter?: any): Promise<DocumentChunk[]> {
        const index = this.client.index(this.indexName);

        // 1. Convert the user's question into a vector
        const queryEmbedding = await this.client.inference.embed(
            this.modelName,
            [query],
            { inputType: 'query', truncate: 'END' }
        );

        // Target specific namespace if provided
        const targetIndex = namespace ? index.namespace(namespace) : index;

        // 2. Search Pinecone
        const result = await targetIndex.query({
            vector: (queryEmbedding.data[0] as any).values,
            topK: limit,
            includeMetadata: true,
            filter: filter // Apply metadata filters (e.g. { projectId: "..." })
        });

        // 3. Convert back to DocumentChunk with VectorMetadata
        return result.matches.map(match => ({
            chunkId: match.id,
            kId: match.metadata?.kId as string,
            textSegment: match.metadata?.text as string,
            metadata: {
                projectId: (match.metadata?.projectId as string) ?? '',
                source_type: (match.metadata?.source_type as 'spec_upload' | 'web_search') ?? 'spec_upload',
                source_reference: (match.metadata?.source_reference as string) ?? '',
                title: (match.metadata?.title as string) ?? '',
                chunkIndex: Number(match.metadata?.chunkIndex ?? 0),
                fetched_at: (match.metadata?.fetched_at as string) ?? new Date().toISOString(),
            },
            score: match.score
        }));
    }

    // --- 3. DELETE document (Cleanup) ---
    async deleteDocumentChunks(kId: string, namespace?: string): Promise<void> {
        const index = this.client.index(this.indexName);
        const targetIndex = namespace ? index.namespace(namespace) : index;

        // Delete everything with this specific kId
        await targetIndex.deleteMany({
            kId: { $eq: kId }
        });

        console.log(`🗑️ Deleted chunks for Document ${kId} (Namespace: ${namespace || 'default'})`);
    }

    /**
     * Delete an entire project's worth of memory
     */
    async deleteProjectChunks(projectId: string, namespace?: string): Promise<void> {
        const index = this.client.index(this.indexName);
        const targetIndex = namespace ? index.namespace(namespace) : index;

        await targetIndex.deleteMany({
            projectId: { $eq: projectId }
        });

        console.log(`🗑️ Deleted chunks for Project ${projectId} (Namespace: ${namespace || 'default'})`);
    }

    /** Clear only web-search vectors in the given namespace. Caller should pass projectName/projectId from getProjectNamespace. */
    async clearWebData(projectId: string, namespace?: string): Promise<void> {
        const index = this.client.index(this.indexName);
        const targetIndex = namespace ? index.namespace(namespace) : index;

        await targetIndex.deleteMany({
            source_type: { $eq: 'web_search' }
        });

        console.log(`🧹 Flushed web data for project ${projectId} (Namespace: ${namespace || 'default'}).`);
    }

}
