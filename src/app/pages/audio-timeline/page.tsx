"use client";
import { AudioTimelinePage } from "@/features/audio/components/audio-timeline-page";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

export default function AudioTimeline() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const folderName = searchParams.get("folderName");

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const handleBack = () => {
    router.back();
  };

  return (
    <AudioTimelinePage
      projectId={projectId}
      folderName={folderName}
      onNavigate={handleNavigate}
      onLogout={handleLogout}
      onBack={handleBack}
    />
  );
}
