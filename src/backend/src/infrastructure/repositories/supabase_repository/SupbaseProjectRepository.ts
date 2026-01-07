import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectRepository } from '../../../domain/interfaces/ProjectRepository'; // Verify path
import { Project, ProjectMetadata, JobInfoSheet } from '../../../domain/core/project.types'; // Verify path

export class SupabaseProjectRepository implements ProjectRepository {


    /**
     * FETCH Project by ID
     * Reconstructs the nested Domain Object from the flat Database Row
     */
    async getById(projectId: string, client: SupabaseClient): Promise<Project | null> {
        const supabase = client;
        
        // 1. Fetch Project
        const { data: projectData, error: projectError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (projectError || !projectData) return null;

        // 2. Fetch Images
        const { data: imageData, error: imageError } = await supabase
            .from('project_images')
            .select('*')
            .eq('project_id', projectId);
            
        // Map project first
        const project = this.mapToDomain(projectData);
        
        // 3. Attach Images if found
        if (imageData && !imageError) {
            project.images = imageData.map(img => ({
                imageId: img.id,
                projectId: img.project_id,
                blobUrl: img.public_url,
                // storagePath: img.storage_path, // Not in Image interface yet?
                description: img.description || "", // Use description from DB
                metadata: {
                    uploadedBy: img.uploaded_by,
                    capturedAt: new Date(img.created_at), // Fallback to upload time
                    tags: [] // Default empty tags
                }
            }));
        }

        return project;
    }

    /**
     * FETCH Projects by Organization ID
     */
    async getByOrgId(organizationId: string, client: SupabaseClient): Promise<Project[]> {
        const supabase = client;
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .eq('organization_id', organizationId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(`Failed to fetch projects: ${error.message}`);
        if (!data) return [];

        return data.map(row => this.mapToDomain(row));
    }

    /**
     * SAVE (Create) a Project
     * Flattens the nested Domain Object into the Database Row
     */
    async save(project: Project, client: SupabaseClient): Promise<void> {
        const supabase = client;
        const { error } = await supabase
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
     * DELETE a Project
     */
    async delete(projectId: string, client: SupabaseClient): Promise<void> {
        const supabase = client;
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', projectId);

        if (error) {
            throw new Error(`Failed to delete project: ${error.message}`);
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