"use client";
import { DashboardPage } from "@/frontend/pages/DashboardPage";
import { useRouter } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview } from "@/frontend/types";
import { ROUTES, getRoute } from "@/app/pages/config/routes";
import { useState } from "react";
import { useAuth } from "@/src/app/context/AuthContext";

export default function Dashboard() {
  const router = useRouter();
  const { user, logout } = useAuth(); // Use the global auth context

  // Mock peer reviews
  const [peerReviews, setPeerReviews] = useState<PeerReview[]>([
    {
      id: 1,
      reportId: 1,
      reportTitle: "Foundation Assessment - Phase 1",
      projectName: "Downtown Tower Complex",
      requestedById: 1,
      requestedByName: "John Davis",
      assignedToId: 2,
      assignedToName: "Sarah Johnson",
      status: "pending",
      requestDate: "2025-11-12",
      requestNotes: "Please review the concrete strength test results.",
      comments: []
    }
  ]);

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    logout();
  };

  const handleSelectProject = (project: Project) => {
    router.push(ROUTES.project(project.id));
  };

  const handleSelectReport = (reportId: number, isPeerReview: boolean = false) => {
    router.push(ROUTES.report(reportId, isPeerReview));
  };

  const handleRequestPeerReview = (reportId: number, reportTitle: string, projectName: string, assignedToId: number, assignedToName: string, notes: string) => {
    console.log("Requested peer review", { reportId, assignedToId, notes });
    // In a real app, update state or call API
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
      peerReviews={peerReviews}
      handleRequestPeerReview={handleRequestPeerReview}
      onRoleSwitch={handleRoleSwitch}
    />
  );
}
