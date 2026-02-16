// src/domain/strategies/DocumentStrategy.ts
import { SupabaseClient } from '@supabase/supabase-js';
export interface DocumentStrategy {
    /**
     * Extracts raw text from the file buffer.
     * @param kId - Optional knowledge item ID; when present, spec strategies can link extracted images to this document for cascade delete.
     */
    extractText(buffer: Buffer, projectId: string, organizationId: string, client: SupabaseClient, kId?: string, fileName?: string): Promise<string>;

    /**
     * Splits text into chunks based on the file's specific structure
     * (e.g. PDF might chunk by page, Word by paragraph)
     */
    chunkText(text: string): string[];
}
