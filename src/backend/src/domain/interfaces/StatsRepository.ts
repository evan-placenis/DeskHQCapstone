// src/backend/src/domain/interfaces/StatsRepository.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { UserProductivityStats, GetUserStatsParams } from "../stats/stats.types";

/**
 * Repository interface for statistics queries.
 * Following Clean Architecture - this is the contract that infrastructure implements.
 */
export interface StatsRepository {
    /**
     * Get total report count for a user
     * @param params - Contains userId to filter reports
     * @param client - Supabase client (user context for RLS)
     * @returns Count of reports created by the user
     */
    getTotalReportCount(params: GetUserStatsParams, client: SupabaseClient): Promise<number>;

    /**
     * Get all productivity stats for a user (aggregated)
     * @param params - Contains userId to filter
     * @param client - Supabase client (user context for RLS)
     * @returns UserProductivityStats object with pre-calculated metrics
     */
    getUserProductivityStats(params: GetUserStatsParams, client: SupabaseClient): Promise<UserProductivityStats>;
}
