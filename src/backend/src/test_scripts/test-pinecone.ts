import { PineconeVectorStore } from '../infrastructure/vector_store/PineconeVectorStore';
import { DocumentChunk } from '../domain/knowledge/rag.types';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import path from 'path';

// Force Load Env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function uploadAndKeep() {
    console.log("🌲 Starting Upload (No Cleanup)...");
    const vectorStore = new PineconeVectorStore();
    
    // We use a fixed ID so you can search for it later
    const testKId = "persistent-test-123"; 

    const chunk: DocumentChunk = {
        chunkId: uuidv4(),
        kId: testKId,
        textSegment: "This data will stay in Pinecone until you manually delete it. It proves the connection works!",
        embeddingVector: [], 
        metadata: { pageNumber: 1, sectionTitle: "Persistent Test" }
    };

    try {
        console.log("📤 Uploading...");
        await vectorStore.upsertChunks([chunk]);
        console.log("✅ Upload Complete!");
        console.log("👀 Go check your Pinecone Console now.");
        console.log(`👉 Look for metadata kId: "${testKId}"`);
    } catch (error) {
        console.error("❌ Error:", error);
    }
}

uploadAndKeep();