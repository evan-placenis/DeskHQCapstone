import { KnowledgeItem } from "../knowledge/rag.types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface KnowledgeRepository {
    save(item: KnowledgeItem, client: SupabaseClient): Promise<void>;
    getById(kId: string, client: SupabaseClient): Promise<KnowledgeItem | null>;
    listByProject(projectId: string, client: SupabaseClient): Promise<KnowledgeItem[]>;
    updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED', client: SupabaseClient): Promise<void>;
    delete(kId: string, client: SupabaseClient): Promise<void>;
    getOrgId(projectId: string, client: SupabaseClient): Promise<string>;
    getOrgNamespace(projectId: string, client: SupabaseClient): Promise<string>;
    /** Returns namespace for Pinecone: "projectName/projectId" (project name sanitized for safe namespace). */
    getProjectNamespace(projectId: string, client: SupabaseClient): Promise<string>;
}