import { SupabaseClient } from '@supabase/supabase-js';
import { KnowledgeRepository } from '../../../domain/interfaces/KnowledgeRepository';
import { KnowledgeItem } from '../../../domain/knowledge/rag.types';

export class SupabaseKnowledgeRepository implements KnowledgeRepository {
    
    // constructor(private supabase: SupabaseClient) {}

    // --- SAVE ---
    async save(item: KnowledgeItem, client: SupabaseClient): Promise<void> {
        // 1. Fetch Organization ID (Required by Database RLS)
        const orgId = await this.getOrgId(item.projectId, client);

        // 2. Insert into Supabase
        const { error } = await client
            .from('knowledge_items')
            .insert({
                k_id: item.kId,
                project_id: item.projectId,
                organization_id: orgId,
                document_type: item.documentType,
                original_file_name: item.originalFileName,
                processed_at: item.uploadedAt // Map Domain 'uploadedAt' -> DB 'processed_at'
                
                // Note: We skip 'content' and 'status' because they are not 
                // in the SQL schema you created earlier.
            });

        if (error) {
            throw new Error(`Supabase Save Error: ${error.message}`);
        }
    }

    // --- GET BY ID ---
    async getById(kId: string, client: SupabaseClient): Promise<KnowledgeItem | null> {
        const { data, error } = await client
            .from('knowledge_items')
            .select('*')
            .eq('k_id', kId)
            .single();

        if (error || !data) return null;

        return this.mapRow(data);
    }

    // --- LIST BY PROJECT ---
    async listByProject(projectId: string, client: SupabaseClient): Promise<KnowledgeItem[]> {
        const { data, error } = await client
            .from('knowledge_items')
            .select('*')
            .eq('project_id', projectId)
            .order('processed_at', { ascending: false });

        if (error) throw new Error(error.message);

        return (data || []).map((row) => this.mapRow(row));
    }

    // --- UPDATE STATUS ---
    async updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED', client: SupabaseClient): Promise<void> {
        // Since the current SQL schema for 'knowledge_items' does not have a 'status' column,
        // we perform a No-Op (do nothing) to satisfy the interface without crashing.
        return Promise.resolve();
        
        /* // If you add a status column later, uncomment this:
        const { error } = await client
            .from('knowledge_items')
            .update({ status: status }) // Ensure DB column exists first!
            .eq('k_id', kId);
        if (error) throw new Error(error.message);
        */
    }

    // --- DELETE ---
    async delete(kId: string, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('knowledge_items')
            .delete()
            .eq('k_id', kId);

        if (error) throw new Error(`Supabase Delete Error: ${error.message}`);
    }

    // --- HELPER: MAP ROW ---
    private mapRow(row: any): KnowledgeItem {
        return {
            kId: row.k_id,
            projectId: row.project_id,
            // We provide safe defaults to keep TypeScript happy.
            documentType: row.document_type,
            originalFileName: row.original_file_name,
            
            content: row.content || '',       // Not stored in this DB schema
            status: 'INDEXED',         // Defaulting to INDEXED since DB doesn't track it
            
            uploadedAt: new Date(row.processed_at) // Map DB 'processed_at' -> Domain 'uploadedAt'
        };
    }

    // --- HELPER: GET ORG ID ---
    async getOrgId(projectId: string, client: SupabaseClient): Promise<string> {
        const { data } = await client
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();
        
        return data?.organization_id || '';
    }

    // --- HELPER: GET ORG NAMESPACE (Name instead of ID) ---
    async getOrgNamespace(projectId: string, client: SupabaseClient): Promise<string> {
        // 1. Get Org ID from Project
        const { data: project } = await client
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();
        
        if (!project?.organization_id) return '';

        // 2. Get Org Name from Organization
        const { data: org } = await client
            .from('organizations')
            .select('name')
            .eq('id', project.organization_id)
            .single();

        // 3. Return sanitized name (e.g. "My_Organization")
        return org?.name ? org.name.trim().replace(/\s+/g, '_') : '';
    }

    /** Project-scoped namespace for Pinecone: "projectName/projectId" (slash kept; Pinecone allows it in namespace). */
    async getProjectNamespace(projectId: string, client: SupabaseClient): Promise<string> {
        const { data: project } = await client
            .from('projects')
            .select('name')
            .eq('id', projectId)
            .single();

        if (!project?.name) return projectId;
        const safeName = project.name.trim().replace(/\s+/g, '_').replace(/[/\\]/g, '_').slice(0, 100);
        return `${safeName}/${projectId}`;
    }
}