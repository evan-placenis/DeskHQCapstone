import { NextResponse } from "next/server";
import { Container } from "@/lib/container";
import { createAuthenticatedClient } from "@/app/api/utils";
import { logger } from "@/lib/logger";
import { ServiceError } from "@/features/capture/services/capture-service";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ "session-id": string }> }
) {
    try {
        const { "session-id": sessionId } = await params;
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

        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;

        /** Omitted when client relies on server-side STT (preserve DB transcript). */
        const transcriptSegments = formData.has("transcript_segments")
            ? (typeof formData.get("transcript_segments") === "string"
                ? (formData.get("transcript_segments") as string)
                : null)
            : undefined;

        const audioDurRaw = formData.get("audio_duration_seconds");
        const audioDurParsed =
            typeof audioDurRaw === "string" && audioDurRaw.trim() !== ""
                ? Number(audioDurRaw)
                : NaN;
        const audioDurationSeconds =
            Number.isFinite(audioDurParsed) && audioDurParsed > 0 ? audioDurParsed : null;

        const photosA = formData.getAll("photos").filter((p): p is File => p instanceof File);
        const photosB = formData.getAll("photos[]").filter((p): p is File => p instanceof File);
        const photos = photosA.length > 0 ? photosA : photosB;

        const takenA = formData.getAll("taken_at_ms");
        const takenB = formData.getAll("taken_at_ms[]");
        const takenAtMsAll = takenA.length > 0 ? takenA : takenB;
        const takenAtMs = takenAtMsAll.map((v) => {
            const n = typeof v === "string" ? parseInt(v, 10) : Number(v);
            return Number.isFinite(n) ? n : 0;
        });

        const result = await Container.captureSessionService.uploadAssets(
            sessionId,
            {
                photos,
                takenAtMs,
                audioFile,
                notesText: null,
                transcriptSegments,
                audioDurationSeconds,
            },
            user.id,
            supabase
        );

        return NextResponse.json(result, { status: 201 });
    } catch (err: unknown) {
        logger.error("Capture session upload:", err);
        const message = err instanceof Error ? err.message : "Upload failed";
        const status = err instanceof ServiceError ? err.statusCode : 500;
        return NextResponse.json({ error: message }, { status });
    }
}
