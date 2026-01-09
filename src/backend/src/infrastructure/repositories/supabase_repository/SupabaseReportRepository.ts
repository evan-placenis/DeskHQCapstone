import { SupabaseClient } from '@supabase/supabase-js';
import { ReportRepository } from '../../../domain/interfaces/ReportRepository'; // Check path
import { Report } from '../../../domain/reports/report.types'; // Check path

export class SupabaseReportRepository implements ReportRepository {

    // constructor(private supabase: SupabaseClient) {}

    // --- 1. SAVE (Create) ---
    async save(report: Report, client: SupabaseClient): Promise<void> {
        // 1. Fetch Org ID (Required by DB Security)
        const orgId = await this.getOrgIdFromProject(report.projectId, client);

        // 2. Insert Report
        // We rely on Postgres to store the 'sections' array as JSONB automatically
        const { error } = await client
            .from('reports')
            .insert({
                id: report.reportId, // Map Domain 'reportId' -> DB 'id'
                project_id: report.projectId,
                organization_id: orgId,
                template_id: report.templateId,
                title: report.title,
                status: report.status,
                version_number: report.versionNumber,
                sections: report.reportContent, // Map Domain 'reportContent' -> DB 'sections'
                updated_at: report.updatedAt
            });

        if (error) throw new Error(`Save Report Failed: ${error.message}`);
    }

    // --- 2. GET BY ID (Read) ---
    async getById(reportId: string, client: SupabaseClient): Promise<Report | null> {
        const { data, error } = await client
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
            createdAt: new Date(data.created_at || data.updated_at), // Map created_at
            
            // JSONB columns come back as objects/arrays automatically
            reportContent: data.sections || [], 
            isReviewRequired: true,
            
            // We usually load history lazily (separately) to keep this fast.
            // If you really need it here, you'd do a second query.
            history: [] 
        };
    }

    // --- 3. UPDATE ---
    async update(report: Report, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from('reports')
            .update({
                title: report.title,
                status: report.status,
                version_number: report.versionNumber,
                sections: report.reportContent, // Updates the JSON content
                updated_at: new Date()
            })
            .eq('id', report.reportId);

        if (error) throw new Error(`Update Report Failed: ${error.message}`);
    }

    // --- 4. VERSIONING ---
    async saveVersion(reportId: string, version: number, snapshot: string, client: SupabaseClient): Promise<void> {
        // We need the organization ID for the version table too
        // (Expensive check, but necessary for RLS if not passed in)
        const { data: report } = await client
            .from('reports')
            .select('organization_id')
            .eq('id', reportId)
            .single();

        if (!report) throw new Error("Cannot version report: Report not found");

        const { error } = await client
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
    async getByProject(projectId: string, client: SupabaseClient): Promise<Report[]> {
        const { data, error } = await client
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
            createdAt: new Date(row.created_at || row.updated_at), // Map created_at
            reportContent: row.sections || [],
            isReviewRequired: true,
            history: []
        }));
    }

    // --- HELPER ---
    private async getOrgIdFromProject(projectId: string, client: SupabaseClient): Promise<string> {
        const { data } = await client
            .from('projects')
            .select('organization_id')
            .eq('id', projectId)
            .single();

        return data?.organization_id || '';
    }
}