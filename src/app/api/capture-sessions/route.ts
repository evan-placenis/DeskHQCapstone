import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST() {
    try {
        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json({ error: "Authentication required" }, { status: 401 });
        }

        const userProfile = await Container.userService.getUserProfile(user.id, supabase);
        if (!userProfile || !userProfile.organization_id) {
            return NextResponse.json(
                { error: "User profile not found or not linked to an organization." },
                { status: 403 }
            );
        }

        const result = await Container.captureSessionService.createSession(
            userProfile.organization_id,
            userProfile.id,
            supabase
        );

        return NextResponse.json(result, { status: 201 });
    } catch (err: unknown) {
        console.error("❌ Capture session create:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create capture session" },
            { status: 500 }
        );
    }
}
