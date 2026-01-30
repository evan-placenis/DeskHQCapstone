import { SupabaseClient } from '@supabase/supabase-js';
import { ReportRepository } from '../../../domain/interfaces/ReportRepository'; // Check path
import { Report } from '../../../domain/reports/report.types'; // Check path

export class SupabaseReportRepository implements ReportRepository {

    // constructor(private supabase: SupabaseClient) {}

    // --- 1. SAVE (Create) ---
    async save(report: Report, client: SupabaseClient): Promise<void> {
        const orgId = await this.getOrgIdFromProject(report.projectId, client);

        const insertData: any = {
            id: report.reportId,
            project_id: report.projectId,
            organization_id: orgId,
            template_id: report.templateId,
            title: report.title,
            status: report.status,
            version_number: report.versionNumber,
            created_by: report.createdBy,
            updated_at: report.updatedAt

        };

        // We still keep tiptap_content here for when a user manually saves/edits
        if (report.tiptapContent !== undefined) {
            insertData.tiptap_content = report.tiptapContent;
        }

        const { error } = await client
            .from('reports')
            .insert(insertData);

        if (error) throw new Error(`Save Report Header Failed: ${error.message}`);
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
            createdBy: data.created_by,
            updatedAt: new Date(data.updated_at),
            createdAt: new Date(data.created_at || data.updated_at), // Map created_at

            // JSONB columns come back as objects/arrays automatically
            reportContent: [],
            tiptapContent: data.tiptap_content || undefined, // Step 2: Markdown content
            isReviewRequired: true,

            // We usually load history lazily (separately) to keep this fast.
            // If you really need it here, you'd do a second query.
            history: []
        };
    }

    async getSection(reportId: string, sectionId: string, client: SupabaseClient): Promise<any | null> {
        const { data, error } = await client
            .from('report_sections')
            .select('*')
            .eq('report_id', reportId)
            .eq('section_id', sectionId)
            .single();

        if (error || !data) return null;
        return data;
    }

    async getTemplateById(reportType: string, client: SupabaseClient): Promise<any | null> { // TODO: Add Template type
        const { data: template } = await client
            .from('report_templates')
            .select('*')
            .eq('id', reportType)
            .single();

        if (!template) throw new Error(`Template for ${reportType} not found.`);

        return template;
    }

    /**
     * UPSERT a single section. 
     * This is the "Engine" for incremental AI writing.
     */
    async upsertSection(
        reportId: string,
        sectionId: string,
        data: {
            heading: string;
            content: string;
            order: number;
            metadata?: any
        },
        client: SupabaseClient
    ): Promise<void> {
        const { error } = await client
            .from('report_sections')
            .upsert({
                report_id: reportId,
                section_id: sectionId,
                heading: data.heading,
                content: data.content,
                metadata: data.metadata || {},
                order: data.order
            }, {
                onConflict: 'report_id, section_id'
            });

        if (error) throw new Error(`Section Sync Failed: ${error.message}`);
    }

    /**
     * FETCH all sections for a report.
     * Used by the flattener to build the final Tiptap view.
     */
    async getSectionsByReportId(reportId: string, client: SupabaseClient): Promise<any[]> {
        const { data, error } = await client
            .from('report_sections')
            .select('*')
            .eq('report_id', reportId)
            .order('order', { ascending: true });

        if (error) throw new Error(`Fetch Sections Failed: ${error.message}`);
        return data || [];
    }

    /**
     * Update the main report header's timestamp 
     * (Called whenever a section is updated)
     */
    async touchReport(reportId: string, client: SupabaseClient): Promise<void> {
        await client
            .from('reports')
            .update({ updated_at: new Date() })
            .eq('id', reportId);
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
            createdBy: row.created_by,
            updatedAt: new Date(row.updated_at),
            createdAt: new Date(row.created_at || row.updated_at), // Map created_at
            reportContent: row.sections || [],
            tiptapContent: row.tiptap_content || undefined, // Step 2: Markdown content
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

    // --- UPDATE ---
    async update(report: Report, client: SupabaseClient): Promise<void> {
        const updateData: any = {
            title: report.title,
            status: report.status,
            version_number: report.versionNumber,
            tiptap_content: report.tiptapContent,
            updated_at: new Date()
        };

        const { error } = await client
            .from('reports')
            .update(updateData)
            .eq('id', report.reportId);

        if (error) throw new Error(`Update Report Failed: ${error.message}`);
    }

    // --- 4. VERSIONING --- TODO: Implement this
    async saveVersion(reportId: string, version: number, snapshot: string, client: SupabaseClient): Promise<void> {
        //TODO
    }


}