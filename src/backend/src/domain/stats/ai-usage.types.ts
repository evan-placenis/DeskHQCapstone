export interface AIUsageQuery {
    startDate: string;
    endDate: string;
    organizationId?: string;
    userId?: string;
    projectId?: string;
    feature?: string;
}

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
