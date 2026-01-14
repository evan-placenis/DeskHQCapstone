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
