// src/backend/src/Services/StatsService.ts

import { SupabaseClient } from "@supabase/supabase-js";
import { StatsRepository } from "./stats-repository";
import {
    UserProductivityStats,
    ActiveSiteWorkItem,
    ActiveSiteWorkRawData,
    ActiveProjectRow,
} from "./domain-stats/stats-types";

/**
 * StatsService - Orchestrates statistics retrieval.
 * Business logic and transformation live here; data access is delegated to the repository.
 */
export class StatsService {
    constructor(private statsRepo: StatsRepository) {}

    async getUserProductivityStats(userId: string, client: SupabaseClient): Promise<UserProductivityStats> {
        return this.statsRepo.getUserProductivityStats({ userId }, client);
    }

    async getTotalReportCount(userId: string, client: SupabaseClient): Promise<number> {
        return this.statsRepo.getTotalReportCount({ userId }, client);
    }

    /**
     * Build the "Active Site Work" view for an organization.
     * Fetches raw data from the repo, then applies all business logic:
     * status derivation, days-active calculation, report aggregation.
     */
    async getActiveSiteWork(orgId: string, client: SupabaseClient): Promise<ActiveSiteWorkItem[]> {
        const raw: ActiveSiteWorkRawData = await this.statsRepo.getActiveSiteWorkData({ orgId }, client);

        if (raw.projects.length === 0) return [];

        const profileMap: Record<string, string> = {};
        for (const p of raw.profiles) {
            profileMap[p.id] = p.full_name || "Unknown";
        }

        type Bucket = { total: number; draft: number; awaitingApproval: number; completed: number };
        const reportsByProject: Record<string, Bucket> = {};
        for (const r of raw.reports) {
            if (!reportsByProject[r.project_id]) {
                reportsByProject[r.project_id] = { total: 0, draft: 0, awaitingApproval: 0, completed: 0 };
            }
            const bucket = reportsByProject[r.project_id];
            bucket.total += 1;

            const status = (r.status || "").toUpperCase();
            if (status === "DRAFT" || status === "PENDING" || status === "GENERATING") {
                bucket.draft += 1;
            } else if (status === "AWAITING_APPROVAL") {
                bucket.awaitingApproval += 1;
            } else if (status === "COMPLETED") {
                bucket.completed += 1;
            } else if (status === "FAILED") {
                console.warn(`[StatsService] Report ${r.id} failed with status: ${status}`);
            }
        }

        const now = new Date();

        return raw.projects.map((project: ActiveProjectRow) => {
            const counts = reportsByProject[project.id] || { total: 0, draft: 0, awaitingApproval: 0, completed: 0 };

            const createdAt = new Date(project.created_at);
            const daysActive = Math.max(
                1,
                Math.ceil((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24))
            );

            let derivedStatus: ActiveSiteWorkItem["status"] = "no-reports";
            if (counts.total > 0 && counts.completed === counts.total) {
                derivedStatus = "completed";
            } else if (counts.awaitingApproval > 0) {
                derivedStatus = "awaiting-approval";
            } else if (counts.total > 0) {
                derivedStatus = "drafting";
            }

            return {
                id: project.id,
                project: project.name,
                technician: profileMap[project.created_by_user_id] || "Unknown Technician",
                startDate: project.created_at,
                status: derivedStatus,
                daysActive,
                totalReports: counts.total,
                reportsDraft: counts.draft,
                reportsAwaitingApproval: counts.awaitingApproval,
                reportsCompleted: counts.completed,
            };
        });
    }
}
