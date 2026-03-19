"use client";

import { CaptureSessionPage } from "@/frontend/pages/CaptureSessionPage";
import { useRouter } from "next/navigation";
import { ROUTES } from "@/app/pages/config/routes";

export default function CaptureSession() {
  const router = useRouter();

  return (
    <CaptureSessionPage
      onClose={() => router.back()}
      onSuccessRedirect={(projectId) => router.push(ROUTES.project(projectId))}
    />
  );
}
