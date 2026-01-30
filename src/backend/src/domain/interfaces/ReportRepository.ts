// src/domain/reports/ReportRepository.ts

import { Report } from "../reports/report.types";
import { SupabaseClient } from "@supabase/supabase-js";

export interface ReportRepository {
    // Basic CRUD
    getById(reportId: string, client: SupabaseClient): Promise<Report | null>;
    save(report: Report, client: SupabaseClient): Promise<void>;
    update(report: Report, client: SupabaseClient): Promise<void>;
    
    // List
    getByProject(projectId: string, client: SupabaseClient): Promise<Report[]>;
    
    // Versioning (Snapshotting)
    saveVersion(reportId: string, version: number, snapshot: string, client: SupabaseClient): Promise<void>;
    
    // Template methods
    getTemplateById(reportType: string, client: SupabaseClient): Promise<any | null>;
    
    // Section methods
    getSectionsByReportId(reportId: string, client: SupabaseClient): Promise<any[]>;
    upsertSection(
        reportId: string,
        sectionId: string,
        data: {
            heading: string;
            content: string;
            order: number;
            metadata?: any;
        },
        client: SupabaseClient
    ): Promise<void>;
    getSection(reportId: string, sectionId: string, client: SupabaseClient): Promise<any | null>;
    
    // Utility methods
    touchReport(reportId: string, client: SupabaseClient): Promise<void>;
}