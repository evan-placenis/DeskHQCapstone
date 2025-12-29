import { SupabaseClient } from '@supabase/supabase-js';
import { ReportRepository } from '../../../domain/interfaces/ReportRepository'; // Check path
import { Report } from '../../../domain/reports/report.types'; // Check path

export class SupabaseReportRepository implements ReportRepository {

    constructor(private supabase: SupabaseClient) {}

    // --- 1. SAVE (Create) ---
    async save(report: Report): Promise<void> {
        // 1. Fetch Org ID (Required by DB Security)
        const orgId = await this.getOrgIdFromProject(report.projectId);

        // 2. Insert Report
        // We rely on Postgres to store the 'sections' array as JSONB automatically
        const { error } = await this.supabase
            .from('reports')
            .insert({
                id: report.reportId, // Map Domain 'reportId' -> DB 'id'
                project_id: report.projectId,
                organization_id: orgId,
                template_id: report.templateId,
                title: report.title,
                status: report.status,
                version_number: report.versionNumber,
                sections: report.sections, // Supabase client handles Array -> JSONB
                updated_at: report.updatedAt
            });

        if (error) throw new Error(`Save Report Failed: ${error.message}`);
    }

    // --- 2. GET BY ID (Read) ---
    async getById(reportId: string): Promise<Report | null> {
        const { data, error } = await this.supabase
            .from('reports')
            .select('*')
            .eq('id', reportId)
            .single();

        if (error || !data) return null;

        // Map DB Row -> Domain Object
        return {
            reportId: data.id,
            projectId: data.project_id,
            templateId: data.template_id,
            title: data.title,
            status: data.status,
            versionNumber: data.version_number,
            updatedAt: new Date(data.updated_at),
            
            // JSONB columns come back as objects/arrays automatically
            sections: data.sections || [], 
            
            // We usually load history lazily (separately) to keep this fast.
            // If you really need it here, you'd do a second query.
            history: [] 
        };
    }

    // --- 3. UPDATE ---
    async update(report: Report): Promise<void> {
        const { error } = await this.supabase
            .from('reports')
            .update({
                title: report.title,
                status: report.status,
                version_number: report.versionNumber,
                sections: report.sections, // Updates the JSON content
                updated_at: new Date()
            })
            .eq('id', report.reportId);

        if (error) throw new Error(`Update Report Failed: ${error.message}`);
    }

    // --- 4. VERSIONING ---
    async saveVersion(reportId: string, version: number, snapshot: string): Promise<void> {
        // We need the organization ID for the version table too
        // (Expensive check, but necessary for RLS if not passed in)
        const { data: report } = await this.supabase
            .from('reports')
            .select('organization_id')
            .eq('id', reportId)
            .single();

        if (!report) throw new Error("Cannot version report: Report not found");

        const { error } = await this.supabase
            .from('report_versions')
            .insert({
                report_id: reportId,
                organization_id: report.organization_id,
                version_number: version,
                snapshot_json: JSON.parse(snapshot), // Store as proper JSONB
                saved_at: new Date()
                // saved_by_user_id: You might want to pass userId to this method later
            });

        if (error) throw new Error(`Save Version Failed: ${error.message}`);
    }

    // --- 5. LIST BY PROJECT ---
    async getByProject(projectId: string): Promise<Report[]> {
        const { data, error } = await this.supabase
            .from('reports')
            .select('*')
            .eq('project_id', projectId)
            .order('updated_at', { ascending: false });

        if (error) throw new Error(error.message);

        return (data || []).map((row: any) => ({
            reportId: row.id,
            projectId: row.project_id,
            templateId: row.template_id,
            title: row.title,
            status: row.status,
            versionNumber: row.version_number,
            updatedAt: new Date(row.updated_at),
            sections: row.sections || [],
            history: []
        }));
    }

    // --- HELPER ---
    private async getOrgIdFromProject(projectId: string): Promise<string> {
        const { data } = await this.supabase
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();

        return data?.organization_id || '';
    }
}