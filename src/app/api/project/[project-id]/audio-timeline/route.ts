import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ "project-id": string }> }
) {
    try {
        const { "project-id": projectId } = await params;
        const { searchParams } = new URL(request.url);
        const folderName = searchParams.get("folderName");

        if (!folderName) {
            return NextResponse.json(
                { error: "folderName query parameter is required" },
                { status: 400 }
            );
        }

        const { supabase, user } = await createAuthenticatedClient();
        if (!user) {
            return NextResponse.json(
                { error: "Authentication required" },
                { status: 401 }
            );
        }

        const result = await Container.captureSessionService.getAudioTimeline(
            projectId,
            folderName,
            supabase
        );

        return NextResponse.json(result);
    } catch (err: unknown) {
        console.error("Audio timeline fetch error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch audio timeline data" },
            { status: 500 }
        );
    }
}
