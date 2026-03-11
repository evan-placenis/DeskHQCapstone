import { NextRequest, NextResponse } from 'next/server';
import { Container } from '@/backend/config/container';
import { createAuthenticatedClient } from '@/app/api/utils';
import type { AIUsageQuery } from '@/backend/domain/stats/ai-usage.types';

/**
 * GET /api/stats/ai-usage
 *
 * Fetches aggregated AI cost/usage data from Helicone.
 * Helicone is the source of truth — no local DB writes.
 *
 * Query params:
 *   startDate  (ISO string, required)
 *   endDate    (ISO string, required)
 *   projectId  (optional)
 *   feature    (optional — "chat" | "ai_edit" | "report_generation")
 *   userId     (optional — defaults to authenticated user for non-managers)
 *   view       (optional — "summary" | "byUser" | "byModel" | "byFeature" | "dashboard", default "dashboard")
 */
export async function GET(req: NextRequest) {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const params = req.nextUrl.searchParams;
        const startDate = params.get('startDate');
        const endDate = params.get('endDate');

        if (!startDate || !endDate) {
            return NextResponse.json(
                { error: 'startDate and endDate query params are required (ISO format)' },
                { status: 400 },
            );
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        const query: AIUsageQuery = {
            startDate,
            endDate,
            organizationId: profile?.organization_id ?? undefined,
            projectId: params.get('projectId') ?? undefined,
            feature: params.get('feature') ?? undefined,
            userId: params.get('userId') ?? undefined,
        };

        const view = params.get('view') ?? 'dashboard';
        const service = Container.heliconeStatsService;

        let data: unknown;
        switch (view) {
            case 'summary':
                data = await service.getSummary(query);
                break;
            case 'byUser':
                data = await service.getUsageByUser(query);
                break;
            case 'byModel':
                data = await service.getUsageByModel(query);
                break;
            case 'byFeature':
                data = await service.getUsageByFeature(query);
                break;
            case 'dashboard':
            default:
                data = await service.getDashboard(query);
                break;
        }

        return NextResponse.json(data, {
            status: 200,
            headers: { 'Cache-Control': 'private, max-age=60' },
        });
    } catch (error: any) {
        console.error('[AI Usage Stats] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch AI usage stats' },
            { status: 500 },
        );
    }
}
