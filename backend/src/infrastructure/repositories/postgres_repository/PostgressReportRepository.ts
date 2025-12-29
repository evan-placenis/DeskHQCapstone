import { Pool } from 'pg';
import { ReportRepository } from '../../../domain/interfaces/ReportRepository'; // Import the Interface
import { Report } from '../../../domain/reports/report.types';

export class PostgresReportRepository implements ReportRepository {
    
    private db: Pool;

    constructor() {
        this.db = new Pool({ connectionString: process.env.DATABASE_URL });
    }

    // --- 1. SAVE (Create) ---
    async save(report: Report): Promise<void> {
        const query = `
            INSERT INTO reports (
                id, project_id, template_id, title, status, 
                version_number, content_snapshot, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `;

        // Notice: We store the entire 'sections', 'history', etc. inside 'content_snapshot'
        // This is the power of Postgres JSONB!
        const snapshot = JSON.stringify({
            sections: report.sections,
            history: report.history
        });

        await this.db.query(query, [
            report.reportId,
            report.projectId,
            report.templateId,
            report.title,
            report.status,
            report.versionNumber,
            snapshot, // <--- Stored as JSONB
            new Date()
        ]);
    }

    // --- 2. GET BY ID (Read) ---
    async getById(reportId: string): Promise<Report | null> {
        const query = `SELECT * FROM reports WHERE id = $1`;
        const result = await this.db.query(query, [reportId]);

        if (result.rows.length === 0) return null;

        const row = result.rows[0];
        const content = row.content_snapshot; // This is the JSON object from DB

        // Reconstruct the Domain Object
        return {
            reportId: row.id,
            projectId: row.project_id,
            templateId: row.template_id,
            title: row.title,
            status: row.status,
            versionNumber: row.version_number,
            updatedAt: row.updated_at,
            
            // Unpack the JSON back into arrays
            sections: content.sections || [],
            history: content.history || []
        };
    }

    // --- 3. UPDATE ---
    async update(report: Report): Promise<void> {
        const query = `
            UPDATE reports 
            SET title = $1, status = $2, version_number = $3, 
                content_snapshot = $4, updated_at = $5
            WHERE id = $6
        `;

        const snapshot = JSON.stringify({
            sections: report.sections,
            history: report.history
        });

        await this.db.query(query, [
            report.title,
            report.status,
            report.versionNumber,
            snapshot,
            new Date(),
            report.reportId
        ]);
    }

    // --- 4. VERSIONING ---
    async saveVersion(reportId: string, version: number, snapshot: string): Promise<void> {
        // Assuming you have a separate table for history to keep the main table light
        const query = `
            INSERT INTO report_versions (report_id, version_number, snapshot_json, saved_at)
            VALUES ($1, $2, $3, $4)
        `;
        await this.db.query(query, [reportId, version, snapshot, new Date()]);
    }

    async getByProject(projectId: string): Promise<Report[]> {
        // Implementation for listing all reports...
        return [];
    }
}


// I used content_snapshot as a JSONB column in the code above.

// The Problem: If you created a separate SQL table for ReportSection and ReportImageReference, saving a report would require 3-4 separate INSERT queries (transactionally complex).

// The Solution: Storing sections as JSON inside the reports table means you can save the whole report in one single INSERT. It's faster and much easier to develop.