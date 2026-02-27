import { NextResponse } from "next/server";
import { Container } from "@/backend/config/container";
import { createAuthenticatedClient } from "@/app/api/utils";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ sessionId: string }> }
) {
    try {
        const { sessionId } = await params;
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

        const { data: session, error: fetchError } = await supabase
            .from("capture_sessions")
            .select("id, project_id, folder_name")
            .eq("id", sessionId)
            .single();

        if (fetchError || !session) {
            return NextResponse.json({ error: "Capture session not found" }, { status: 404 });
        }

        const projectId = session.project_id;
        if (!projectId) {
            return NextResponse.json(
                { error: "Capture session not finalized. Call finalize with projectId or createProject first." },
                { status: 400 }
            );
        }

        const formData = await request.formData();
        const audioFile = formData.get("audio") as File | null;
        const notesEntry = formData.get("notes_text");
        const notesText = typeof notesEntry === "string" ? notesEntry : null;

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

        const organizationId = userProfile.organization_id;
        const folderName = session.folder_name;
        const uploadedImageRows: unknown[] = [];

        for (let i = 0; i < photos.length; i++) {
            const file = photos[i];
            const takenAt = takenAtMs[i] ?? 0;
            const uploadedImage = await Container.storageService.uploadProjectImage(
                projectId,
                organizationId,
                user.id,
                file,
                file.name,
                folderName,
                "",
                supabase
            );

            await supabase.from("capture_session_images").insert({
                capture_session_id: sessionId,
                project_image_id: uploadedImage.id,
                taken_at_ms: takenAt,
            });
            uploadedImageRows.push(uploadedImage);
        }

        let audioResult: { public_url: string; storage_path: string } | null = null;

        if (audioFile && audioFile.size > 0) {
            const fileName = `session-audio-${sessionId}.webm`;
            const result = await Container.storageService.uploadProjectAudio(
                projectId,
                organizationId,
                user.id,
                audioFile,
                fileName,
                folderName,
                supabase
            );

            await supabase
                .from("capture_sessions")
                .update({
                    audio_storage_path: result.storage_path,
                    audio_public_url: result.public_url,
                    notes_text: notesText,
                    status: "uploaded",
                })
                .eq("id", sessionId);

            audioResult = { public_url: result.public_url, storage_path: result.storage_path };
        } else {
            await supabase
                .from("capture_sessions")
                .update({
                    notes_text: notesText,
                    status: "uploaded",
                })
                .eq("id", sessionId);
        }

        return NextResponse.json(
            {
                images: uploadedImageRows,
                audio: audioResult,
            },
            { status: 201 }
        );
    } catch (err: unknown) {
        console.error("❌ Capture session upload:", err);
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Upload failed" },
            { status: 500 }
        );
    }
}
