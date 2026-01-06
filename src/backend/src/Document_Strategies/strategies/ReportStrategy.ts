import { DocumentStrategy } from './interfaces';
import mammoth from 'mammoth';

export class ReportStrategy implements DocumentStrategy {
    async extractText(buffer: Buffer): Promise<string> {
        // ReportStrategy currently extracts raw text directly
        // We can evolve this to be smarter later if needed
        const result = await mammoth.extractRawText({ buffer });
        return result.value;
    }

    chunkText(text: string): string[] {
        // Simple chunking for reports
        return this.splitTextIntoChunks(text, 1000);
    }

    private splitTextIntoChunks(text: string, chunkSize: number): string[] {
        const chunks: string[] = [];
        let currentChunk = "";
        const sentences = text.split(/(?<=[.?!])\s+/);

        for (const sentence of sentences) {
            if ((currentChunk + sentence).length > chunkSize) {
                chunks.push(currentChunk.trim());
                currentChunk = sentence;
            } else {
                currentChunk += (currentChunk ? " " : "") + sentence;
            }
        }
        if (currentChunk) chunks.push(currentChunk.trim());
        return chunks;
    }
}

