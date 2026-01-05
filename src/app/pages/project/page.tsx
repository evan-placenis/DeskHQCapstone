"use client";
import { ProjectDetailPage } from "@/frontend/pages/ProjectDetailPage";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { Project } from "@/frontend/types";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function ProjectDetail() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("projectId");
  const projectId = projectIdParam || 1;

  // Mock project lookup
  const project: Project = {
    id: projectId,
    name: "Bridge Inspection - Route 95",
    reports: 8,
    photos: 24,
    status: "Active",
    lastUpdated: "2025-12-20"
  };

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    router.push(ROUTES.dashboard);
  };

  const handleSelectReport = (reportId: number) => {
    router.push(ROUTES.report(reportId));
  };

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
