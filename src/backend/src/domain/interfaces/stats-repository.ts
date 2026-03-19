// src/backend/src/domain/interfaces/StatsRepository.ts

import { SupabaseClient } from "@supabase/supabase-js";
import {
    UserProductivityStats,
    GetUserStatsParams,
    GetActiveSiteWorkParams,
    ActiveSiteWorkRawData,
} from "../stats/stats-types";

/**
 * Repository interface for statistics queries.
 * Following Clean Architecture - this is the contract that infrastructure implements.
 */
export interface StatsRepository {
    getTotalReportCount(params: GetUserStatsParams, client: SupabaseClient): Promise<number>;

    getUserProductivityStats(params: GetUserStatsParams, client: SupabaseClient): Promise<UserProductivityStats>;

    /**
     * Fetch the raw data needed to build the "Active Site Work" view:
     * active projects, their reports, and creator profiles.
     */
    getActiveSiteWorkData(params: GetActiveSiteWorkParams, client: SupabaseClient): Promise<ActiveSiteWorkRawData>;
}
