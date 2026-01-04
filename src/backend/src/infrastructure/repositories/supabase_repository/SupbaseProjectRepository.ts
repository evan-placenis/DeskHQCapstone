import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectRepository } from '../../../domain/interfaces/ProjectRepository'; // Verify path
import { Project, ProjectMetadata, JobInfoSheet } from '../../../domain/core/project.types'; // Verify path

export class SupabaseProjectRepository implements ProjectRepository {
    
    constructor(private supabase: SupabaseClient) {}

    /**
     * FETCH Project by ID
     * Reconstructs the nested Domain Object from the flat Database Row
     */
    async getById(projectId: string): Promise<Project | null> {
        const { data, error } = await this.supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (error || !data) return null;

        return this.mapToDomain(data);
    }

    /**
     * SAVE (Create) a Project
     * Flattens the nested Domain Object into the Database Row
     */
    async save(project: Project): Promise<void> {
        const { error } = await this.supabase
            .from('projects')
            .insert({
                // 1. Root Fields
                id: project.projectId,
                organization_id: project.organizationId,
                name: project.name,
                status: project.status,

                // 2. Metadata (Flattened)
                created_by_user_id: project.metadata.createdByUserId,
                created_date: project.metadata.createdDate,
                // last_modified_date is auto-handled by DB Trigger, but we can force it if needed:
                last_modified_date: project.metadata.lastModifiedDate, 

                // 3. Job Info (Flattened)
                client_name: project.jobInfo.clientName,
                site_address: project.jobInfo.siteAddress,
                job_extra_data: project.jobInfo.parsedData // Maps Domain 'parsedData' -> DB JSONB 'job_extra_data'
            });

        if (error) {
            throw new Error(`Failed to save project: ${error.message}`);
        }
    }

    /**
     * HELPER: Map SQL Row -> Domain Object
     */
    private mapToDomain(row: any): Project {
        // 1. Reconstruct Metadata
        const metadata: ProjectMetadata = {
            createdDate: new Date(row.created_date),
            createdByUserId: row.created_by_user_id,
            lastModifiedDate: new Date(row.last_modified_date),
            status: row.status
        };

        // 2. Reconstruct Job Info
        const jobInfo: JobInfoSheet = {
            clientName: row.client_name || "",
            siteAddress: row.site_address || "",
            parsedData: row.job_extra_data || {} // JSONB column
        };

        // 3. Construct Main Object
        return {
            projectId: row.id,
            organizationId: row.organization_id,
            name: row.name,
            status: row.status,

            createdAt: new Date(row.created_date),
            updatedAt: new Date(row.last_modified_date),
            metadata: metadata,
            jobInfo: jobInfo,
            
            // Note: We initialize these as empty arrays.
            // If you need them, you would usually fetch them in separate repositories
            // (e.g. imageRepo.getByProject(id)) or use a Supabase join here.
            images: [],
            knowledgeItems: []
        };
    }
}