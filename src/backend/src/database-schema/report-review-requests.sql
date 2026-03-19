-- =============================================================================
-- REPORT REVIEW REQUESTS (Peer Review)
-- =============================================================================
-- Tracks when a user requests a peer to review a report.
-- Run this after the main schema.

CREATE TABLE IF NOT EXISTS public.report_review_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES public.reports(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    requested_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    assigned_to UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
    request_notes TEXT,
    request_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_date TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups: "What reviews are assigned to me?"
CREATE INDEX IF NOT EXISTS idx_report_review_requests_assigned_to 
ON public.report_review_requests(assigned_to, status);

-- Index for org-scoped queries
CREATE INDEX IF NOT EXISTS idx_report_review_requests_org 
ON public.report_review_requests(organization_id);

ALTER TABLE public.report_review_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access report reviews in own org" ON public.report_review_requests
FOR ALL USING (organization_id = get_auth_org_id());

CREATE TRIGGER update_report_review_requests_updated_at 
BEFORE UPDATE ON public.report_review_requests 
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
