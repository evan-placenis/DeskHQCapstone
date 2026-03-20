import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

/**
 * GET /api/organizations/users
 * Returns all users (profiles) in the current user's organization.
 * Used by RequestPeerReviewModal to show colleagues to assign.
 */
export async function GET() {
  try {
    const { user, supabase } = await createAuthenticatedClient();
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

    const { data: profiles, error } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, role")
      .eq("organization_id", userProfile.organization_id)
      .order("full_name");

    if (error) {
      console.error("Error fetching org users:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Map to frontend-friendly format (exclude current user - caller can filter)
    const users = (profiles || []).map((p: any) => ({
      id: p.id,
      name: p.full_name || "Unknown",
      email: "", // profiles table doesn't have email - would need auth.users join
      role: p.role || "MEMBER",
      department: "",
      specialty: "",
    }));

    return NextResponse.json({ users });
  } catch (err: any) {
    console.error("Organization users error:", err);
    return NextResponse.json({ error: err.message || "Failed to fetch users" }, { status: 500 });
  }
}
