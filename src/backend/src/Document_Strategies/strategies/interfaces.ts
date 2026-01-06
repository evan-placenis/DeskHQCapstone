// src/domain/strategies/DocumentStrategy.ts
export interface DocumentStrategy {
    /**
     * Extracts raw text from the file buffer
     */
    extractText(buffer: Buffer): Promise<string>;

    /**
     * Splits text into chunks based on the file's specific structure
     * (e.g. PDF might chunk by page, Word by paragraph)
     */
    chunkText(text: string): string[];
}
