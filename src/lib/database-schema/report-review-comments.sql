-- =============================================================================
-- REPORT REVIEW COMMENTS (Peer review thread + inline highlights)
-- Run after report_review_requests.sql
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.report_review_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_request_id UUID NOT NULL REFERENCES public.report_review_requests(id) ON DELETE CASCADE,
    author_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('comment', 'suggestion', 'issue')),
    highlighted_text TEXT,
    section_id TEXT,
    resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_review_comments_request
ON public.report_review_comments(review_request_id, created_at);

ALTER TABLE public.report_review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "report_review_comments org via request" ON public.report_review_comments
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.report_review_requests r
    WHERE r.id = report_review_comments.review_request_id
      AND r.organization_id = get_auth_org_id()
  )
);
