//This is the contract for your vector database (Pinecone, Weaviate, etc.). It says: "I need to save chunks and find similar ones."

import { DocumentChunk } from "../knowledge/rag.types";

export interface VectorStore {
    /**
     * Save chopped up text into the vector DB
     */
    upsertChunks(chunks: DocumentChunk[], namespace?: string): Promise<void>;

    /**
     * The Magic: Find text relevant to the user's query.
     * @param query - The user's question
     * @param limit - How many results to return (e.g., top 3)
     * @param namespace - The organization ID to isolate data
     * @param filter - Metadata filters
     */
    similaritySearch(query: string, limit: number, namespace?: string, filter?: any): Promise<DocumentChunk[]>;
    
    /**
     * Delete all chunks for a specific document
     */
    deleteDocumentChunks(K_id: string, namespace?: string): Promise<void>;

    /**
     * Delete all chunks for a specific project
     */
    deleteProjectChunks(projectId: string, namespace?: string): Promise<void>;
}