// src/app/pages/config/routes.ts

export type Page = 
  | 'login' 
  | 'register' 
  | 'select-org' 
  | 'org-password' 
  | 'dashboard' 
  | 'project' 
  | 'report' 
  | 'analytics' 
  | 'mystats' 
  | 'reviewer' 
  | 'settings' 
  | 'audio-timeline'
  | 'capture'
  | 'capture-session';

export const ROUTES = {
  login: '/pages/login',
  register: '/pages/register',
  selectOrg: '/pages/select-org',
  orgPassword: '/pages/organization_password',
  dashboard: '/pages/dashboard',
  project: (id: string | number) => `/pages/project?projectId=${id}`,
  report: (id: string | number, fromPeerReview: boolean = false) => 
    `/pages/report?id=${id}${fromPeerReview ? '&fromPeerReview=true' : ''}`,
  analytics: '/pages/analytics_dashboard',
  mystats: '/pages/mystats',
  reviewer: '/pages/reviewer',
  settings: '/pages/settings',
  audioTimeline: (projectId?: string | number) => 
    projectId ? `/pages/audio_timeline?projectId=${projectId}` : '/pages/audio_timeline',
  capture: '/pages/capture',
  captureSession: '/pages/capture_session',
};

// Helper to resolve route by Page type (for simple routes)
export const getRoute = (page: Page): string => {
  switch (page) {
    case 'login': return ROUTES.login;
    case 'register': return ROUTES.register;
    case 'select-org': return ROUTES.selectOrg;
    case 'org-password': return ROUTES.orgPassword;
    case 'dashboard': return ROUTES.dashboard;
    case 'analytics': return ROUTES.analytics;
    case 'mystats': return ROUTES.mystats;
    case 'reviewer': return ROUTES.reviewer;
    case 'settings': return ROUTES.settings;
    case 'capture': return ROUTES.capture;
    case 'capture-session': return ROUTES.captureSession;
    // For parameterized routes, we might return a base path or handle it differently
    // This function is mainly for the simple 1:1 mapping cases
    case 'project': return '/pages/project'; 
    case 'report': return '/pages/report';
    case 'audio-timeline': return '/pages/audio_timeline';
    default: return ROUTES.dashboard;
  }
};
