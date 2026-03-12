import { NextResponse } from "next/server";
import { createAuthenticatedClient } from "@/app/api/utils";

export async function GET(
    request: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;
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

        // Fetch session audio URL and duration from capture_sessions (match by folder_name and project_id)
        const { data: session } = await supabase
            .from("capture_sessions")
            .select("id, audio_public_url, audio_storage_path, audio_duration_seconds, created_at")
            .eq("folder_name", folderName)
            .eq("project_id", projectId)
            .maybeSingle();

        const sessionId = session?.id ?? null;
        const audioUrl = session?.audio_public_url ?? null;
        const audioStoragePath = session?.audio_storage_path ?? null;
        const audioDurationSeconds = session?.audio_duration_seconds ?? null;

        // Fetch photos for this folder from project_images
        const { data: images, error: imagesError } = await supabase
            .from("project_images")
            .select("id, file_name, public_url, storage_path, created_at")
            .eq("project_id", projectId)
            .eq("folder_name", folderName)
            .order("created_at", { ascending: true });

        if (imagesError) {
            return NextResponse.json(
                { error: imagesError.message },
                { status: 500 }
            );
        }

        // If we have a session, join with capture_session_images to get taken_at_ms
        let takenAtMap: Record<string, number> = {};
        if (sessionId && images && images.length > 0) {
            const imageIds = images.map((img: any) => img.id);
            const { data: sessionImages } = await supabase
                .from("capture_session_images")
                .select("project_image_id, taken_at_ms")
                .eq("capture_session_id", sessionId)
                .in("project_image_id", imageIds);

            if (sessionImages) {
                for (const si of sessionImages) {
                    takenAtMap[si.project_image_id] = si.taken_at_ms;
                }
            }
        }

        const photos = (images ?? []).map((img: any, idx: number) => ({
            id: img.id,
            url: img.public_url,
            storagePath: img.storage_path,
            name: img.file_name,
            takenAtMs: takenAtMap[img.id] ?? idx * 1000,
        }));

        return NextResponse.json({
            sessionId,
            audioUrl,
            audioStoragePath,
            audioDurationSeconds,
            photos,
        });
    } catch (err: unknown) {
        console.error("Audio timeline fetch error:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to fetch audio timeline data" },
            { status: 500 }
        );
    }
}
