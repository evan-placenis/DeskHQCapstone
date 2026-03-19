"use client";
import { DashboardPage } from "@/frontend/pages/dashboard-page";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { Project } from "@/frontend/types";
import { ROUTES, getRoute } from "@/app/pages/config/routes";
import { useAuth } from "@/app/context/auth-context";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth();

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    logout();
  };

  const handleSelectProject = (project: Project) => {
    router.push(ROUTES.project(project.id));
  };

  const handleSelectReport = (reportId: string | number, isPeerReview: boolean = false) => {
    router.push(ROUTES.report(reportId, isPeerReview));
  };

  const handleRoleSwitch = (role: "manager" | "technician") => {
    console.log("Switching role to", role);
    // In a real app, update user context
  };

  // If user is null, the AuthProvider will handle the redirect/loading state
  // But we can return null here to be safe
  if (!user) return null;

  return (
    <DashboardPage 
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onSelectProject={handleSelectProject}
      onSelectReport={handleSelectReport}
      currentUser={user}
      onRoleSwitch={handleRoleSwitch}
    />
  );
}
