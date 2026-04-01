/**
 * Central definitions for browser `fetch()` paths (Next.js App Router API routes).
 * Keeps URLs in one place to avoid drift between client components and route handlers.
 */

export const apiRoutes = {
  auth: {
    login: "/api/auth/login",
    register: "/api/auth/register",
  },
  organizations: {
    list: "/api/organizations",
    users: "/api/organizations/users",
  },
  stats: "/api/stats",
  chat: {
    root: "/api/chat",
    sessionStream: (sessionId: string) => `/api/chat/sessions/${sessionId}/stream`,
  },
  project: {
    byId: (id: string | number) => `/api/project/${id}`,
    list: (userId?: string | number) =>
      userId != null ? `/api/project/list?userId=${userId}` : "/api/project/list",
    create: "/api/project/create",
    activeSiteWork: "/api/project/active-site-work",
    images: (projectId: string | number) => `/api/project/${projectId}/images`,
    imagesWithQuery: (
      projectId: string | number,
      query: { imageId?: string | number; folderName?: string },
    ) => {
      const base = `/api/project/${projectId}/images`;
      if (query.imageId != null && query.imageId !== "") {
        return `${base}?imageId=${encodeURIComponent(String(query.imageId))}`;
      }
      if (query.folderName != null) return `${base}?folderName=${encodeURIComponent(query.folderName)}`;
      return base;
    },
    reports: (projectId: string | number) => `/api/project/${projectId}/reports`,
    audioTimeline: (projectId: string, folderName?: string) =>
      folderName != null
        ? `/api/project/${encodeURIComponent(projectId)}/audio-timeline?folderName=${encodeURIComponent(folderName)}`
        : `/api/project/${encodeURIComponent(projectId)}/audio-timeline`,
  },
  knowledge: {
    store: (projectId?: string | number) =>
      projectId != null ? `/api/knowledge/store?projectId=${projectId}` : "/api/knowledge/store",
    byId: (id: string | number) => `/api/knowledge/${id}`,
  },
  report: {
    byId: (reportId: string | number) => `/api/report/${reportId}`,
    status: (reportId: string | number) => `/api/report/${reportId}/status`,
    assignedReview: (reportId: string | number) => `/api/report/${reportId}/assigned-review`,
    resume: (reportId: string | number) => `/api/report/${reportId}/resume`,
    aiEdit: (reportId: string | number) => `/api/report/${reportId}/ai-edit`,
    reviewRequest: "/api/report/review-request",
    reviewComment: "/api/report/review-comment",
    reviewCommentById: (commentId: string | number) =>
      `/api/report/review-comment/${encodeURIComponent(String(commentId))}`,
    generate: "/api/report/generate",
  },
  captureSessions: {
    root: "/api/capture-sessions",
    finalize: (sessionId: string) => `/api/capture-sessions/${sessionId}/finalize`,
    upload: (sessionId: string) => `/api/capture-sessions/${sessionId}/upload`,
  },
} as const;

/** API paths that must bypass client-side auth redirects. */
export const publicApiAuthPaths = [apiRoutes.auth.login, apiRoutes.auth.register] as const;
