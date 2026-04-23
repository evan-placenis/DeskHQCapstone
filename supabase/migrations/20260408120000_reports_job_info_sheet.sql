alter table public.reports add column if not exists job_info_sheet jsonb;

comment on column public.reports.job_info_sheet is 'Parsed job info workbook JSON at report creation';
