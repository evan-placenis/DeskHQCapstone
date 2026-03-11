"use client";

import { useState, useEffect, useCallback } from "react";

export interface AIUsageSummary {
    totalCost: number;
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    totalTokens: number;
    periodStart: string;
    periodEnd: string;
}

export interface AIUsageByUser {
    userId: string;
    cost: number;
    totalRequests: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    lastActive: string;
}

export interface AIUsageByModel {
    model: string;
    cost: number;
    totalRequests: number;
    totalTokens: number;
}

export interface AIUsageByFeature {
    feature: string;
    cost: number;
    totalRequests: number;
    totalTokens: number;
}

export interface AIUsageDashboard {
    summary: AIUsageSummary;
    byUser: AIUsageByUser[];
    byModel: AIUsageByModel[];
    byFeature: AIUsageByFeature[];
}

function getDateRange(range: string): { startDate: string; endDate: string } {
    const now = new Date();
    const end = now.toISOString();
    let start: Date;

    switch (range) {
        case "week":
            start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case "month":
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
            break;
        case "quarter":
            start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
            break;
        case "year":
            start = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        default:
            start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    return { startDate: start.toISOString(), endDate: end };
}

export function useAIUsage(timeRange: string, extraParams?: Record<string, string>) {
    const [data, setData] = useState<AIUsageDashboard | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);

        try {
            const { startDate, endDate } = getDateRange(timeRange);
            const params = new URLSearchParams({
                startDate,
                endDate,
                view: "dashboard",
                ...extraParams,
            });

            const response = await fetch(`/api/stats/ai-usage?${params}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch AI usage data (${response.status})`);
            }

            const json = await response.json();
            setData(json);
        } catch (err: any) {
            setError(err.message ?? "Unknown error");
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [timeRange, JSON.stringify(extraParams)]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}
