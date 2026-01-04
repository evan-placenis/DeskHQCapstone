"use client";
import { CapturePage } from "@/frontend/pages/CapturePage";
import { useRouter } from "next/navigation";
import { Project } from "@/frontend/types";
import { ROUTES } from "@/app/pages/config/routes";

export default function Capture() {
  const router = useRouter();

  // Mock projects
  const projects: Project[] = [
    { id: 1, name: "Downtown Tower Complex", status: "Active", reports: 12, photos: 156, lastUpdated: "2025-11-18" },
    { id: 2, name: "Riverside Industrial Park", status: "Active", reports: 8, photos: 94, lastUpdated: "2025-11-15" },
    { id: 3, name: "Highway Bridge Inspection", status: "Active", reports: 5, photos: 67, lastUpdated: "2025-11-10" },
  ];

  const handleClose = () => {
    router.back();
  };

  const handleSave = (projectId: number, photos: any[], audioTranscript?: string, groupName?: string) => {
    console.log("Saving capture to project:", projectId, photos, audioTranscript, groupName);
    // In a real app, you would save this data via API
    router.push(ROUTES.project(projectId));
  };

  const handleCreateProject = () => {
    // Navigate to dashboard with create project modal trigger?
    // Or just log for now
    console.log("Create project requested");
    router.push(ROUTES.dashboard);
  };

  return (
    <CapturePage
      onClose={handleClose}
      onSave={handleSave}
      onCreateProject={handleCreateProject}
      projects={projects}
    />
  );
}

