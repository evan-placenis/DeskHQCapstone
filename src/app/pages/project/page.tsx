"use client";
import { useState, useEffect } from "react";
import { ProjectDetailPage } from "@/frontend/pages/ProjectDetailPage";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { Project } from "@/frontend/types";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function ProjectDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
      if (!projectIdParam) {
          router.push(ROUTES.dashboard);
          return;
      }

      setLoading(true);
      // Fetch Project Details
      fetch(`/api/project/${projectIdParam}`)
        .then(res => {
            if (!res.ok) throw new Error("Failed to fetch project");
            return res.json();
        })
        .then(data => {
            // Map backend project to frontend Project interface
            setProject({
                id: data.projectId,
                name: data.name,
                description: data.description,
                status: data.status,
                lastUpdated: data.updatedAt ? new Date(data.updatedAt).toISOString().split('T')[0] : "",
                reports: 0, // Not used for display, internal lists are fetched
                photos: 0 // Not used for display
            });
        })
        .catch(err => {
            console.error("Error loading project:", err);
            // If invalid ID (like "1"), stay on loading or show error?
            // User prefers removing mocks, so if it fails, it fails.
        })
        .finally(() => setLoading(false));

  }, [projectIdParam, router]);

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    router.push(ROUTES.dashboard);
  };

  const handleSelectReport = (reportId: number | string) => {
    router.push(ROUTES.report(reportId));
  };

  if (loading) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
            <div className="text-slate-500 animate-pulse">Loading Project...</div>
        </div>
      );
  }

  if (!project) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
            <div className="text-slate-900 font-semibold">Project not found</div>
            <button 
                onClick={() => router.push(ROUTES.dashboard)}
                className="text-theme-primary hover:underline"
            >
                Return to Dashboard
            </button>
        </div>
      );
  }

  return (
    <ProjectDetailPage
      project={project}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onBack={handleBack}
      onSelectReport={handleSelectReport}
    />
  );
}
