import { SupabaseClient } from '@supabase/supabase-js';
import { CaptureSessionRepository, CaptureSession, CaptureSessionImage } from '../../../domain/interfaces/CaptureSessionRepository';

export class SupabaseCaptureSessionRepository implements CaptureSessionRepository {

    async create(session: CaptureSession, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from("capture_sessions")
            .insert({
                id: session.id,
                organization_id: session.organization_id,
                created_by: session.created_by,
                status: session.status,
                folder_name: session.folder_name,
            });

        if (error) {
            throw new Error(`Failed to create capture session: ${error.message}`);
        }
    }

    async getById(sessionId: string, client: SupabaseClient): Promise<CaptureSession | null> {
        const { data, error } = await client
            .from("capture_sessions")
            .select("*")
            .eq("id", sessionId)
            .single();

        if (error || !data) return null;
        return data as CaptureSession;
    }

    async update(sessionId: string, updates: Partial<CaptureSession>, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from("capture_sessions")
            .update(updates)
            .eq("id", sessionId);

        if (error) {
            throw new Error(`Failed to update capture session: ${error.message}`);
        }
    }

    async insertSessionImage(image: CaptureSessionImage, client: SupabaseClient): Promise<void> {
        const { error } = await client
            .from("capture_session_images")
            .insert({
                capture_session_id: image.capture_session_id,
                project_image_id: image.project_image_id,
                taken_at_ms: image.taken_at_ms,
            });

        if (error) {
            throw new Error(`Failed to insert capture session image: ${error.message}`);
        }
    }

    async getSessionByFolderAndProject(folderName: string, projectId: string, client: SupabaseClient): Promise<CaptureSession | null> {
        const { data, error } = await client
            .from("capture_sessions")
            .select("*")
            .eq("folder_name", folderName)
            .eq("project_id", projectId)
            .maybeSingle();

        if (error) {
            throw new Error(`Failed to fetch capture session: ${error.message}`);
        }
        return data as CaptureSession | null;
    }

    async getSessionImagesBySessionId(sessionId: string, imageIds: string[], client: SupabaseClient): Promise<CaptureSessionImage[]> {
        const { data, error } = await client
            .from("capture_session_images")
            .select("project_image_id, taken_at_ms, capture_session_id")
            .eq("capture_session_id", sessionId)
            .in("project_image_id", imageIds);

        if (error) {
            throw new Error(`Failed to fetch capture session images: ${error.message}`);
        }
        return (data ?? []) as CaptureSessionImage[];
    }
}
