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
}