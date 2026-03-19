// src/backend/src/infrastructure/repositories/supabase_repository/SupabaseStatsRepository.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { StatsRepository } from "../../../domain/interfaces/StatsRepository";
import {
    UserProductivityStats,
    GetUserStatsParams,
    GetActiveSiteWorkParams,
    ActiveSiteWorkRawData,
} from "../../../domain/stats/stats.types";

/**
 * Supabase implementation of StatsRepository.
 * Pure data access — no business logic or transformation.
 */
export class SupabaseStatsRepository implements StatsRepository {

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

    async getUserProductivityStats(params: GetUserStatsParams, client: SupabaseClient): Promise<UserProductivityStats> {
        const totalReports = await this.getTotalReportCount(params, client);

        return {
            userId: params.userId,
            totalReports,
        };
    }

    async getActiveSiteWorkData(params: GetActiveSiteWorkParams, client: SupabaseClient): Promise<ActiveSiteWorkRawData> {
        const { orgId } = params;

        const { data: projects, error: projectsError } = await client
            .from("projects")
            .select("id, name, status, created_at, created_by_user_id")
            .eq("organization_id", orgId)
            .eq("status", "ACTIVE")
            .order("created_at", { ascending: false });

        if (projectsError) {
            throw new Error(`Failed to fetch active projects: ${projectsError.message}`);
        }

        if (!projects || projects.length === 0) {
            return { projects: [], reports: [], profiles: [] };
        }

        const projectIds = projects.map((p: any) => p.id);
        const creatorIds = [...new Set(
            projects.map((p: any) => p.created_by_user_id).filter(Boolean)
        )];

        const [reportsRes, profilesRes] = await Promise.all([
            client
                .from("reports")
                .select("id, project_id, status, created_by")
                .in("project_id", projectIds),
            creatorIds.length > 0
                ? client.from("profiles").select("id, full_name").in("id", creatorIds)
                : Promise.resolve({ data: [], error: null }),
        ]);

        if (reportsRes.error) {
            throw new Error(`Failed to fetch reports: ${reportsRes.error.message}`);
        }
        if (profilesRes.error) {
            throw new Error(`Failed to fetch profiles: ${profilesRes.error.message}`);
        }

        return {
            projects: projects as any[],
            reports: (reportsRes.data || []) as any[],
            profiles: (profilesRes.data || []) as any[],
        };
    }
}
