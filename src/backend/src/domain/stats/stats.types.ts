// src/backend/src/domain/stats/stats.types.ts

/**
 * User Productivity Statistics
 * Pre-calculated statistics for the analytics dashboard.
 * Following "Thin Client" philosophy - all calculations done on backend.
 */
export interface UserProductivityStats {
    userId: string;
    totalReports: number;
    // Future stats will be added here:
    // completedThisWeek: number;
    // draftReports: number;
    // avgCompletionDays: number;
}

/**
 * Parameters for fetching user stats
 */
export interface GetUserStatsParams {
    userId: string;
}

/**
 * Parameters for fetching active site work across an organization.
 */
export interface GetActiveSiteWorkParams {
    orgId: string;
}

/**
 * Raw project row returned from the repository layer.
 * No business logic applied yet — that happens in the service.
 */
export interface ActiveProjectRow {
    id: string;
    name: string;
    status: string;
    created_at: string;
    created_by_user_id: string;
}

/**
 * Raw report row returned from the repository layer.
 */
export interface ActiveProjectReportRow {
    id: string;
    project_id: string;
    status: string;
    created_by: string;
}

/**
 * Profile lookup result from the repository layer.
 */
export interface ProfileRow {
    id: string;
    full_name: string;
}

/**
 * Raw data bundle returned by the repository for active site work.
 * The service layer transforms this into ActiveSiteWorkItem[].
 */
export interface ActiveSiteWorkRawData {
    projects: ActiveProjectRow[];
    reports: ActiveProjectReportRow[];
    profiles: ProfileRow[];
}

/**
 * Report status values as stored in the database.
 */
export type ReportStatus = "PENDING" | "GENERATING" | "DRAFT" | "AWAITING_APPROVAL" | "COMPLETED" | "FAILED";

/**
 * Derived display status for an active project, based on its reports.
 *   - "no-reports"          — project exists but has zero reports
 *   - "drafting"            — reports exist but none are awaiting approval or completed
 *   - "awaiting-approval"   — at least one report is AWAITING_APPROVAL
 *   - "completed"           — all reports are COMPLETED
 */
export type ActiveSiteWorkStatus = "no-reports" | "drafting" | "awaiting-approval" | "completed";

/**
 * A single active site work entry, fully computed by the service layer.
 * This is the shape sent to the frontend.
 */
export interface ActiveSiteWorkItem {
    id: string;
    project: string;
    technician: string;
    startDate: string;
    status: ActiveSiteWorkStatus;
    daysActive: number;
    totalReports: number;
    reportsDraft: number;
    reportsAwaitingApproval: number;
    reportsCompleted: number;
}
