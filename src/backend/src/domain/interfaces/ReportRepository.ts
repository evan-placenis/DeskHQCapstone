// src/domain/reports/ReportRepository.ts

import { Report } from "../reports/report.types";

export interface ReportRepository {
    // Basic CRUD
    getById(reportId: string): Promise<Report | null>;
    save(report: Report): Promise<void>;
    update(report: Report): Promise<void>;
    
    // List
    getByProject(projectId: string): Promise<Report[]>;
    
    // Versioning (Snapshotting)
    saveVersion(reportId: string, version: number, snapshot: string): Promise<void>;
}