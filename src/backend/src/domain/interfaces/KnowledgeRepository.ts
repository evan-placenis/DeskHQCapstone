import { KnowledgeItem } from "../knowledge/rag.types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface KnowledgeRepository {
    save(item: KnowledgeItem, client: SupabaseClient): Promise<void>;
    getById(kId: string, client: SupabaseClient): Promise<KnowledgeItem | null>;
    listByProject(projectId: string, client: SupabaseClient): Promise<KnowledgeItem[]>;
    updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED', client: SupabaseClient): Promise<void>;
}