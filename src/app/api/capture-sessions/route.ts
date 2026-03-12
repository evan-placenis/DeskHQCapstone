import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { v4 as uuidv4 } from "uuid";

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

        const sessionId = uuidv4();
        const folderName = `capture-session-${sessionId}`;

        const { error } = await supabase
            .from("capture_sessions")
            .insert({
                id: sessionId,
                organization_id: userProfile.organization_id,
                created_by: userProfile.id,
                status: "draft",
                folder_name: folderName,
            });

        if (error) {
            console.error("❌ Capture session create error:", error);
            return NextResponse.json(
                { error: error.message || "Failed to create capture session" },
                { status: 500 }
            );
        }

        return NextResponse.json(
            { sessionId, folderName },
            { status: 201 }
        );
    } catch (err: unknown) {
        console.error("❌ Capture session create:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to create capture session" },
            { status: 500 }
        );
    }
}
