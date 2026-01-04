//This is the contract for your vector database (Pinecone, Weaviate, etc.). It says: "I need to save chunks and find similar ones."

import { DocumentChunk } from "../knowledge/rag.types";

export interface VectorStore {
    /**
     * Save chopped up text into the vector DB
     */
    upsertChunks(chunks: DocumentChunk[]): Promise<void>;

    /**
     * The Magic: Find text relevant to the user's query.
     * @param vector - The query converted into numbers
     * @param limit - How many results to return (e.g., top 3)
     */
    similaritySearch(query: string, limit: number, filter?: any): Promise<DocumentChunk[]>;
    
    /**
     * Delete all chunks for a specific document (e.g., if user deletes a file)
     */
    deleteChunks(kId: string): Promise<void>;
}