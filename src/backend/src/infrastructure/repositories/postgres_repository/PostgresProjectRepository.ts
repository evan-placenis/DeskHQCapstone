import { Pool } from 'pg';
import { ProjectRepository } from '../../../domain/interfaces/ProjectRepository'; // Ensure this Interface exists!
import { Project, JobInfoSheet, ProjectMetadata } from '../../../domain/core/project.types';

export class PostgresProjectRepository implements ProjectRepository {
    
    private db: Pool;

    constructor() {
        // Connects using environment variables (PGUSER, PGPASSWORD, etc.)
        this.db = new Pool({
            connectionString: process.env.DATABASE_URL
        });
    }

    /**
     * Fetch a Project by ID and reconstruct the Domain Object
     */
    async getById(projectId: string): Promise<Project | null> {
        
        // 1. Run the SQL Query
        // We join with metadata tables if needed, or assume a flattened structure
        const query = `
            SELECT 
                p.id, p.name, p.status, p.created_at, p.organization_id,
                j.client_name, j.site_address, j.data_json as job_data
            FROM projects p
            LEFT JOIN job_info j ON p.id = j.project_id
            WHERE p.id = $1
        `;

        const result = await this.db.query(query, [projectId]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];

        // 2. Map SQL Rows -> Domain Objects

        // Construct Metadata
        const metadata: ProjectMetadata = {
            createdDate: row.created_at,
            status: row.status,
            // createdByUserId: row.created_by ... (if you have this column)
            lastModifiedDate: new Date(), // Placeholder or fetch actual column
            createdByUserId: row.user_id
        };

        // Construct Job Info
        const jobInfo: JobInfoSheet = {
            clientName: row.client_name || "",
            siteAddress: row.site_address || "",
            parsedData: row.job_data || {} // JSONB column
        };

        // Construct the Main Project Object
        const project: Project = {
            projectId: row.id,
            organizationId: row.organization_id,
            name: row.name,
            status: row.status,
            metadata: metadata,
            jobInfo: jobInfo,
            // Images are usually fetched in a separate query if the list is huge,
            // but for now, we initialize it as empty or optional.
            images: [] 
        };

        return project;
    }

    /**
     * Save a new project (Required by the Interface)
     */
    async save(project: Project): Promise<void> {
        const client = await this.db.connect();
        try {
            await client.query('BEGIN'); // Start Transaction

            // 1. Insert Project Root
            const projectQuery = `
                INSERT INTO projects (id, organization_id, name, status, created_at)
                VALUES ($1, $2, $3, $4, $5)
            `;
            await client.query(projectQuery, [
                project.projectId,
                project.organizationId,
                project.name,
                project.status,
                project.metadata.createdDate
            ]);

            // 2. Insert Job Info
            const jobQuery = `
                INSERT INTO job_info (project_id, client_name, site_address, data_json)
                VALUES ($1, $2, $3, $4)
            `;
            await client.query(jobQuery, [
                project.projectId,
                project.jobInfo.clientName,
                project.jobInfo.siteAddress,
                project.jobInfo.parsedData // Postgres automatically handles the JSON object
            ]);

            await client.query('COMMIT'); // Commit Transaction
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }
    }
}