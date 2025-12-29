import { Pool } from 'pg';
import { KnowledgeRepository } from '../../../domain/interfaces/KnowledgeRepository';
import { KnowledgeItem } from '../../../domain/knowledge/rag.types';

//This is standard plumbing. It allows the UI to list "Uploaded Files" and check if they are done processing.

export class PostgresKnowledgeRepository implements KnowledgeRepository {
    private db: Pool;

    constructor() {
        this.db = new Pool({ connectionString: process.env.DATABASE_URL });
    }

    async save(item: KnowledgeItem): Promise<void> {
        const query = `
            INSERT INTO knowledge_items (id, project_id, doc_type, filename, content, status, uploaded_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;
        await this.db.query(query, [
            item.kId,
            item.projectId,
            item.documentType,
            item.originalFileName,
            item.content,
            item.status,
            item.uploadedAt
        ]);
    }

    async getById(kId: string): Promise<KnowledgeItem | null> {
        const res = await this.db.query('SELECT * FROM knowledge_items WHERE id = $1', [kId]);
        if (res.rows.length === 0) return null;
        return this.mapRow(res.rows[0]);
    }

    async listByProject(projectId: string): Promise<KnowledgeItem[]> {
        const res = await this.db.query('SELECT * FROM knowledge_items WHERE project_id = $1', [projectId]);
        return res.rows.map(this.mapRow);
    }

    async updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED'): Promise<void> {
        await this.db.query('UPDATE knowledge_items SET status = $1 WHERE id = $2', [status, kId]);
    }

    private mapRow(row: any): KnowledgeItem {
        return {
            kId: row.id,
            projectId: row.project_id,
            documentType: row.doc_type,
            originalFileName: row.filename,
            content: row.content,
            status: row.status,
            uploadedAt: row.uploaded_at
        };
    }
}