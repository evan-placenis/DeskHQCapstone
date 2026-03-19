import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * GET /api/project/active-site-work
 *
 * Returns all ACTIVE projects in the user's organization with
 * report progress and technician info. Delegates all data access
 * and business logic to StatsService.
 */
export async function GET() {
  try {
    const { supabase, user } = await createAuthenticatedClient();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userProfile = await Container.userService.getUserProfile(user.id, supabase);
    if (!userProfile?.organization_id) {
      return NextResponse.json(
        { error: "User profile or organization not found" },
        { status: 404 }
      );
    }

    const activeSiteWork = await Container.statsService.getActiveSiteWork(
      userProfile.organization_id,
      supabase
    );

    return NextResponse.json({ activeSiteWork });
  } catch (err: any) {
    console.error("Active site work error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to fetch active site work" },
      { status: 500 }
    );
  }
}
