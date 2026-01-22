// src/app/api/stats/route.ts

import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "../utils";
import { Container } from "@/backend/config/container";

/**
 * GET /api/stats
 * Fetches productivity statistics for the authenticated user.
 * Returns pre-calculated metrics following "Thin Client" philosophy.
 */
export async function GET() {
    try {
        // 1. Get authenticated user
        const { supabase, user } = await createAuthenticatedClient();

        if (!user) {
            return NextResponse.json(
                { error: "Unauthorized - Please log in" },
                { status: 401 }
            );
        }

        // 2. Fetch stats via service
        const stats = await Container.statsService.getUserProductivityStats(
            user.id,
            supabase
        );

        // 3. Return stats
        return NextResponse.json(stats, { status: 200 });

    } catch (error: any) {
        console.error("❌ Stats Route Error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to fetch stats" },
            { status: 500 }
        );
    }
}
