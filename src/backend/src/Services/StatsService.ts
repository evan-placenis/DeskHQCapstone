// src/backend/src/Services/StatsService.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { StatsRepository } from "../domain/interfaces/StatsRepository";
import { UserProductivityStats } from "../domain/stats/stats.types";

/**
 * StatsService - Orchestrates statistics retrieval.
 * Following Clean Architecture - this service layer handles business logic
 * and delegates data access to the repository.
 */
export class StatsService {
    constructor(private statsRepo: StatsRepository) {}

    /**
     * Get productivity statistics for a user.
     * @param userId - The user's ID
     * @param client - Supabase client with user context (for RLS)
     * @returns Pre-calculated productivity statistics
     */
    async getUserProductivityStats(userId: string, client: SupabaseClient): Promise<UserProductivityStats> {
        return this.statsRepo.getUserProductivityStats({ userId }, client);
    }

    /**
     * Get just the total report count for a user.
     * Useful for lightweight calls when only this metric is needed.
     * @param userId - The user's ID
     * @param client - Supabase client with user context (for RLS)
     * @returns Total number of reports created by the user
     */
    async getTotalReportCount(userId: string, client: SupabaseClient): Promise<number> {
        return this.statsRepo.getTotalReportCount({ userId }, client);
    }
}
