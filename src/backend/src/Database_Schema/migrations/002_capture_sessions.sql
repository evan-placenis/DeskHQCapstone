-- =============================================================================
-- Migration 002: Capture Sessions (Phase 1 - Storage + DB primitives)
-- Additive only. Do not modify existing project_images or image routes.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. CAPTURE SESSIONS TABLE
-- -----------------------------------------------------------------------------
CREATE TABLE public.capture_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'finalized', 'uploaded')),
    folder_name TEXT NOT NULL,
    audio_storage_path TEXT,
    audio_public_url TEXT,
    notes_text TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 2. CAPTURE SESSION IMAGES (links session to project_images after upload)
-- -----------------------------------------------------------------------------
CREATE TABLE public.capture_session_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    capture_session_id UUID NOT NULL REFERENCES public.capture_sessions(id) ON DELETE CASCADE,
    project_image_id UUID NOT NULL REFERENCES public.project_images(id) ON DELETE CASCADE,
    taken_at_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (mirror org-based access like project/reports)
-- -----------------------------------------------------------------------------
ALTER TABLE public.capture_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.capture_session_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access capture_sessions in own org" ON public.capture_sessions
FOR ALL USING (organization_id = get_auth_org_id());

CREATE POLICY "Access capture_session_images via session org" ON public.capture_session_images
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.capture_sessions cs
        WHERE cs.id = capture_session_images.capture_session_id
        AND cs.organization_id = get_auth_org_id()
    )
);

-- -----------------------------------------------------------------------------
-- 4. PROJECT-AUDIO BUCKET (Supabase Storage)
-- Path format: {organizationId}/{projectId}/{folder_name}/session-audio-{captureSessionId}.{ext}
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'project-audio',
    'project-audio',
    true,
    52428800,
    ARRAY['audio/webm', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg']
)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: allow org members to SELECT/INSERT objects in project-audio
-- Object name (path) = organizationId/projectId/folder_name/filename
CREATE POLICY "Project audio select by org"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'project-audio'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_auth_org_id()::text)
);

CREATE POLICY "Project audio insert by org"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'project-audio'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_auth_org_id()::text)
);

CREATE POLICY "Project audio update by org"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'project-audio'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_auth_org_id()::text)
);

CREATE POLICY "Project audio delete by org"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'project-audio'
    AND (string_to_array(name, '/'))[1] = (SELECT public.get_auth_org_id()::text)
);
