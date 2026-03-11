import type {
    AIUsageQuery,
    AIUsageSummary,
    AIUsageByUser,
    AIUsageByModel,
    AIUsageByFeature,
    AIUsageDashboard,
} from '../domain/stats/ai-usage.types';

const HELICONE_API_BASE = 'https://api.helicone.ai';

interface CacheEntry<T> {
    data: T;
    expiresAt: number;
}

const CACHE_TTL_MS = 60_000;

/**
 * HeliconeStatsService — reads aggregated AI cost/usage data directly from
 * Helicone's REST API.  No local DB writes; Helicone is the source of truth.
 *
 * Results are cached in-memory with a short TTL to avoid hammering Helicone
 * on every dashboard load.
 */
export class HeliconeStatsService {
    private cache = new Map<string, CacheEntry<unknown>>();

    private get apiKey(): string {
        const key = process.env.HELICONE_API_KEY;
        if (!key) throw new Error('HELICONE_API_KEY is required for HeliconeStatsService.');
        return key;
    }

    async getDashboard(query: AIUsageQuery): Promise<AIUsageDashboard> {
        const cacheKey = `dashboard:${JSON.stringify(query)}`;
        const cached = this.fromCache<AIUsageDashboard>(cacheKey);
        if (cached) return cached;

        const [summary, byUser, byModel, byFeature] = await Promise.all([
            this.getSummary(query),
            this.getUsageByUser(query),
            this.getUsageByModel(query),
            this.getUsageByFeature(query),
        ]);

        const dashboard: AIUsageDashboard = { summary, byUser, byModel, byFeature };
        this.toCache(cacheKey, dashboard);
        return dashboard;
    }

    async getSummary(query: AIUsageQuery): Promise<AIUsageSummary> {
        const cacheKey = `summary:${JSON.stringify(query)}`;
        const cached = this.fromCache<AIUsageSummary>(cacheKey);
        if (cached) return cached;

        const filter = this.buildRequestFilter(query);
        const body = {
            filter,
            offset: 0,
            limit: 1000,
            includeInputs: false,
        };

        // Debug: try both the RMT filter path and the simpler "request" filter path
        // const debugBody = { filter: 'all', offset: 0, limit: 5, includeInputs: false };
        // const debugRes = await this.heliconePost('/v1/request/query-clickhouse', debugBody);
        // const debugRows = debugRes.data ?? [];
        // console.log('[Helicone DEBUG] Unfiltered result — count:', debugRows.length, '| full response:', JSON.stringify(debugRes).slice(0, 600));

        // // Also try the clickhouse endpoint which Helicone recommends for bulk queries
        // try {
        //     const chRes = await this.heliconePost('/v1/request/query/clickhouse', debugBody);
        //     const chRows = chRes.data ?? [];
        //     console.log('[Helicone DEBUG] Clickhouse endpoint — count:', chRows.length, '| full response:', JSON.stringify(chRes).slice(0, 600));
        // } catch (e: any) {
        //     console.log('[Helicone DEBUG] Clickhouse endpoint error:', e.message);
        // }

        const res = await this.heliconePost('/v1/request/query-clickhouse', body);
        console.log('[Helicone DEBUG] Summary result:', res.data.length);
        const requests: HeliconeRequestRow[] = res.data ?? [];

        const summary: AIUsageSummary = {
            totalCost: 0,
            totalRequests: requests.length,
            totalPromptTokens: 0,
            totalCompletionTokens: 0,
            totalTokens: 0,
            periodStart: query.startDate,
            periodEnd: query.endDate,
        };

        for (const r of requests) {
            summary.totalCost += r.cost ?? 0;
            summary.totalPromptTokens += r.prompt_tokens ?? 0;
            summary.totalCompletionTokens += r.completion_tokens ?? 0;
            summary.totalTokens += r.total_tokens ?? 0;
        }

        this.toCache(cacheKey, summary);
        return summary;
    }

    async getUsageByUser(query: AIUsageQuery): Promise<AIUsageByUser[]> {
        const cacheKey = `byUser:${JSON.stringify(query)}`;
        const cached = this.fromCache<AIUsageByUser[]>(cacheKey);
        if (cached) return cached;

        const timeFilter = {
            startTimeUnixSeconds: Math.floor(new Date(query.startDate).getTime() / 1000),
            endTimeUnixSeconds: Math.floor(new Date(query.endDate).getTime() / 1000),
        };

        const userFilter = this.buildUserFilter(query);
        console.log('[Helicone DEBUG] User filter for usage by user:', userFilter);

        const body = {
            filter: userFilter,
            offset: 0,
            limit: 50,
            timeFilter,
            sort: { cost: 'desc' as const },
        };

        const res = await this.heliconePost('/v1/user/metrics/query', body);
        const users: HeliconeUserMetric[] = res.data?.users ?? [];

        const result: AIUsageByUser[] = users.map(u => ({
            userId: u.user_id,
            cost: u.cost ?? 0,
            totalRequests: u.total_requests ?? 0,
            totalPromptTokens: u.total_prompt_tokens ?? 0,
            totalCompletionTokens: u.total_completion_tokens ?? 0,
            lastActive: u.last_active ?? '',
        }));

        this.toCache(cacheKey, result);
        return result;
    }

    async getUsageByModel(query: AIUsageQuery): Promise<AIUsageByModel[]> {
        const cacheKey = `byModel:${JSON.stringify(query)}`;
        const cached = this.fromCache<AIUsageByModel[]>(cacheKey);
        if (cached) return cached;

        const filter = this.buildRequestFilter(query);
        const body = { filter, offset: 0, limit: 1000, includeInputs: false };
        const res = await this.heliconePost('/v1/request/query', body);
        const requests: HeliconeRequestRow[] = res.data ?? [];

        const modelMap = new Map<string, AIUsageByModel>();
        for (const r of requests) {
            const model = r.response_model || r.request_model || 'unknown';
            const existing = modelMap.get(model) ?? { model, cost: 0, totalRequests: 0, totalTokens: 0 };
            existing.cost += r.cost ?? 0;
            existing.totalRequests += 1;
            existing.totalTokens += r.total_tokens ?? 0;
            modelMap.set(model, existing);
        }

        const result = Array.from(modelMap.values()).sort((a, b) => b.cost - a.cost);
        this.toCache(cacheKey, result);
        return result;
    }

    async getUsageByFeature(query: AIUsageQuery): Promise<AIUsageByFeature[]> {
        const cacheKey = `byFeature:${JSON.stringify(query)}`;
        const cached = this.fromCache<AIUsageByFeature[]>(cacheKey);
        if (cached) return cached;

        const filter = this.buildRequestFilter(query);
        const body = { filter, offset: 0, limit: 1000, includeInputs: false };
        const res = await this.heliconePost('/v1/request/query', body);
        const requests: HeliconeRequestRow[] = res.data ?? [];

        const featureMap = new Map<string, AIUsageByFeature>();
        for (const r of requests) {
            const feature = r.request_properties?.Feature ?? 'unknown';
            const existing = featureMap.get(feature) ?? { feature, cost: 0, totalRequests: 0, totalTokens: 0 };
            existing.cost += r.cost ?? 0;
            existing.totalRequests += 1;
            existing.totalTokens += r.total_tokens ?? 0;
            featureMap.set(feature, existing);
        }

        const result = Array.from(featureMap.values()).sort((a, b) => b.cost - a.cost);
        this.toCache(cacheKey, result);
        return result;
    }

    // ---- Helicone filter builders ----

    private buildRequestFilter(query: AIUsageQuery): HeliconeFilterNode {
        // const leaves: HeliconeFilterNode[] = [
        //     {
        //         request_response_rmt: {
        //             request_created_at: {
        //                 gte: new Date(query.startDate).toISOString(),
        //             },
        //         },
        //     },
        //     {
        //         request_response_rmt: {
        //             request_created_at: {
        //                 lte: new Date(query.endDate).toISOString(),
        //             },
        //         },
        //     },
        // ];

        // if (query.organizationId) {
        //     leaves.push({
        //         request_response_rmt: {
        //             properties: { organization_id: { equals: query.organizationId } },
        //         },
        //     });
        // }
        // if (query.userId) {
        //     leaves.push({
        //         request_response_rmt: {
        //             user_id: { equals: query.userId },
        //         },
        //     });
        // }
        // if (query.projectId) {
        //     leaves.push({
        //         request_response_rmt: {
        //             properties: { ProjectId: { equals: query.projectId } },
        //         },
        //     });
        // }
        // if (query.feature) {
        //     leaves.push({
        //         request_response_rmt: {
        //             properties: { Feature: { equals: query.feature } },
        //         },
        //     });
        // }

        // return this.andAll(leaves);
        return "all";
    }

    private buildUserFilter(query: AIUsageQuery): HeliconeFilterNode {
        if (query.organizationId) {
            return {
                request_response_rmt: {
                    properties: { organization_id: { equals: query.organizationId } },
                },
            };
        }
        return 'all';
    }

    private andAll(nodes: HeliconeFilterNode[]): HeliconeFilterNode {
        if (nodes.length === 0) return 'all';
        if (nodes.length === 1) return nodes[0];
        return nodes.reduce((acc, node) => ({
            operator: 'and' as const,
            left: acc,
            right: node,
        }));
    }

    // ---- HTTP transport ----

    private async heliconePost(path: string, body: unknown): Promise<any> {
        const url = `${HELICONE_API_BASE}${path}`;
        console.log('[Helicone API] POST', path, JSON.stringify(body).slice(0, 500));
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${this.apiKey}`,
            },
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const text = await response.text().catch(() => '');
            console.error('[Helicone API] Error response:', response.status, text.slice(0, 500));
            throw new Error(`Helicone API ${path} returned ${response.status}: ${text}`);
        }

        const json = await response.json();
        console.log('[Helicone API] Response from', path, '— keys:', Object.keys(json), '| data type:', typeof json.data, Array.isArray(json.data) ? `(array len ${json.data.length})` : '', '| sample:', JSON.stringify(json).slice(0, 300));
        return json;
    }

    // ---- In-memory cache ----

    private fromCache<T>(key: string): T | null {
        const entry = this.cache.get(key) as CacheEntry<T> | undefined;
        if (!entry) return null;
        if (Date.now() > entry.expiresAt) {
            this.cache.delete(key);
            return null;
        }
        return entry.data;
    }

    private toCache<T>(key: string, data: T): void {
        this.cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    }
}

// ---- Helicone API shapes (private to this module) ----

type HeliconeFilterNode =
    | Record<string, any>
    | { operator: 'and' | 'or'; left: HeliconeFilterNode; right: HeliconeFilterNode }
    | 'all';

interface HeliconeRequestRow {
    cost?: number;
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
    response_model?: string;
    request_model?: string;
    request_properties?: Record<string, string>;
    request_user_id?: string;
}

interface HeliconeUserMetric {
    user_id: string;
    cost?: number;
    total_requests?: number;
    total_prompt_tokens?: number;
    total_completion_tokens?: number;
    last_active?: string;
}
