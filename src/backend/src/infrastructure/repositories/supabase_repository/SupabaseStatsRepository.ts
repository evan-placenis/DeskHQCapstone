// src/backend/src/infrastructure/repositories/supabase_repository/SupabaseStatsRepository.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { StatsRepository } from "../../../domain/interfaces/StatsRepository";
import { UserProductivityStats, GetUserStatsParams } from "../../../domain/stats/stats.types";

/**
 * Supabase implementation of StatsRepository.
 * Contains all SQL aggregation queries for user statistics.
 * Following "Thin Client" philosophy - all calculations happen here.
 */
export class SupabaseStatsRepository implements StatsRepository {

    /**
     * Get total count of reports created by a specific user.
     * Uses COUNT(*) aggregation on the reports table.
     */
    async getTotalReportCount(params: GetUserStatsParams, client: SupabaseClient): Promise<number> {
        const { userId } = params;

        const { count, error } = await client
            .from('reports')
            .select('*', { count: 'exact', head: true })
            .eq('created_by', userId);

        if (error) {
            console.error('Error fetching total report count:', error);
            throw new Error(`Failed to get report count: ${error.message}`);
        }

        return count ?? 0;
    }

    /**
     * Get all productivity statistics for a user in one call.
     * Currently returns totalReports, will be extended for more metrics.
     */
    async getUserProductivityStats(params: GetUserStatsParams, client: SupabaseClient): Promise<UserProductivityStats> {
        const { userId } = params;

        // For now, just get totalReports
        // Future: Add parallel queries for other stats
        const totalReports = await this.getTotalReportCount(params, client);

        return {
            userId,
            totalReports,
            // Future stats:
            // completedThisWeek: await this.getCompletedThisWeek(params, client),
            // draftReports: await this.getDraftReportCount(params, client),
            // avgCompletionDays: await this.getAvgCompletionDays(params, client),
        };
    }
}
