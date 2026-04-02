import { SupabaseClient } from "@supabase/supabase-js";

/** DB check: idle | queued | ready | failed */
export type TranscriptionStatus = "idle" | "queued" | "ready" | "failed";

export interface CaptureSession {
    id: string;
    organization_id: string;
    created_by: string;
    status: string;
    folder_name: string;
    project_id?: string;
    audio_storage_path?: string;
    audio_public_url?: string;
    audio_duration_seconds?: number | null;
    notes_text?: string | null;
    transcript_text?: string | null;
    transcription_status?: TranscriptionStatus;
    /** User-visible message when transcription_status is failed */
    transcription_error?: string | null;
    created_at?: string;
}

export type CaptureSessionListRow = Pick<
    CaptureSession,
    "id" | "folder_name" | "transcription_status" | "transcription_error"
>;

export interface CaptureSessionImage {
    capture_session_id: string;
    project_image_id: string;
    taken_at_ms: number;
}

export interface CaptureSessionRepository {
    create(session: CaptureSession, client: SupabaseClient): Promise<void>;
    getById(sessionId: string, client: SupabaseClient): Promise<CaptureSession | null>;
    update(sessionId: string, updates: Partial<CaptureSession>, client: SupabaseClient): Promise<void>;
    insertSessionImage(image: CaptureSessionImage, client: SupabaseClient): Promise<void>;
    getSessionByFolderAndProject(folderName: string, projectId: string, client: SupabaseClient): Promise<CaptureSession | null>;
    getSessionImagesBySessionId(sessionId: string, imageIds: string[], client: SupabaseClient): Promise<CaptureSessionImage[]>;
    listByProjectId(projectId: string, client: SupabaseClient): Promise<CaptureSessionListRow[]>;
}
