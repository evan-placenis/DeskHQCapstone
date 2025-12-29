//Prerequisites: You would typically run npm install @pinecone-database/pinecone

//hen we save the vector, we also save the Text Segment inside Pinecone's metadata. This makes retrieval super fast—we get the "numbers" and the "text" back in a single call, so we don't have to look up the text in Postgres again

import { Pinecone } from '@pinecone-database/pinecone';
import { ScoredPineconeRecord } from '@pinecone-database/pinecone';
import { v4 as uuidv4 } from 'uuid';
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
        this.client = new Pinecone({apiKey: process.env.PINECONE_API_KEY!});
        this.indexName = process.env.PINECONE_INDEX_NAME || 'capstone-docs';
    }

    /**
     * Takes raw text, asks Pinecone to embed it, then saves it.
     */
    // --- 1. UPSERT (Save Text -> Pinecone Embeds It -> Save Vectors) ---
    async upsertChunks(chunks: DocumentChunk[]): Promise<void> {
        const index = this.client.index(this.indexName);
        
        // Extract just the text strings to send to the AI
        const textToEmbed = chunks.map(c => c.textSegment);

        // 1. Ask Pinecone to calculate the vectors for us
        // (This replaces your old "missing embedding vector" error check)
        const embeddings = await this.client.inference.embed(
            this.modelName,
            textToEmbed,
            { inputType: 'passage', truncate: 'END' }
        );

        // 2. Merge the new vectors back with your existing chunk data
        const records = chunks.map((chunk, i) => ({
            id: chunk.chunkId,
            values: (embeddings.data[i] as any).values, // The AI just gave us this!
            metadata: {
                kId: chunk.kId,
                text: chunk.textSegment,
                page: chunk.metadata.pageNumber,
                section: chunk.metadata.sectionTitle || ''
            }
        }));

        // 3. Save to Database
        await index.upsert(records);
        console.log(`✅ Pinecone: Upserted ${chunks.length} chunks via Inference API.`);
    }

    // --- 2. SEARCH (Query Text -> Pinecone Embeds It -> Retrieve Context) ---
    // Note: Input changed from "vector: number[]" to "query: string"
    async similaritySearch(query: string, limit: number): Promise<DocumentChunk[]> {
        const index = this.client.index(this.indexName);

        // 1. Convert the user's question into a vector
        const queryEmbedding = await this.client.inference.embed(
            this.modelName,
            [query],
            { inputType: 'query', truncate: 'END' }
        );

        // 2. Search Pinecone
        const result = await index.query({
            vector: (queryEmbedding.data[0] as any).values,
            topK: limit,
            includeMetadata: true
        });

        // 3. Convert back to your App's format
        return result.matches.map(match => ({
            chunkId: match.id,
            kId: match.metadata?.kId as string,
            textSegment: match.metadata?.text as string,
            metadata: {
                pageNumber: Number(match.metadata?.page),
                sectionTitle: match.metadata?.section as string
            },
            score: match.score // Confidence score
        }));
    }

    // --- 3. DELETE (Cleanup) ---
    async deleteChunks(kId: string): Promise<void> {
        const index = this.client.index(this.indexName);
        
        // This syntax deletes everything with this specific kId
        await index.deleteMany({
            kId: { $eq: kId } 
        });
        
        console.log(`🗑️ Deleted chunks for Document ${kId}`);
    }
}