"use client";
import { AudioTimelinePage } from "@/frontend/pages/AudioTimelinePage";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function AudioTimeline() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get('projectId');
  
  // Mock project name lookup
  const projectName = projectId ? `Project #${projectId}` : "Bridge Inspection - Route 95";

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    router.back();
  };

  const handleRoleSwitch = (role: "manager" | "technician") => {
    console.log("Switching role:", role);
    // Add logic if needed
  };

  return (
    <AudioTimelinePage
      projectName={projectName}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onBack={handleBack}
      // @ts-ignore - onRoleSwitch missing in component props definition but might be used
      onRoleSwitch={handleRoleSwitch}
    />
  );
}

