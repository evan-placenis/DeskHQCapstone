"use client";

import { CaptureSessionPage } from "@/features/capture/components/capture-session-page";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/app/pages/config/routes";

export default function CaptureSession() {
  const router = useRouter();

  return (
    <CaptureSessionPage
      onClose={() => router.push(ROUTES.dashboard)}
      onSuccessRedirect={(projectId) => {
        router.push(ROUTES.project(projectId, { tab: "photos" }));
      }}
    />
  );
}
