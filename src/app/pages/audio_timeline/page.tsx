"use client";
import { useState, useEffect } from "react";
import { AudioTimelinePage, TimelinePhoto } from "@/frontend/pages/AudioTimelinePage";
import { useRouter, useSearchParams } from "next/navigation";
import { Page } from "@/app/pages/config/routes";
import { ROUTES, getRoute } from "@/app/pages/config/routes";

interface AudioTimelineApiResponse {
  sessionId: string | null;
  audioUrl: string | null;
  audioStoragePath: string | null;
  audioDurationSeconds: number | null;
  photos: TimelinePhoto[];
}

export default function AudioTimeline() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectId = searchParams.get("projectId");
  const folderName = searchParams.get("folderName");

  const projectName = projectId ? `Project #${projectId}` : "Audio Timeline";

  const [sessionData, setSessionData] = useState<AudioTimelineApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !folderName) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(
      `/api/project/${encodeURIComponent(projectId)}/audio-timeline?folderName=${encodeURIComponent(folderName)}`
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: AudioTimelineApiResponse) => {
        if (!cancelled) setSessionData(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, folderName]);

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
    <>
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-100">
          <div className="h-full bg-blue-500 animate-pulse w-1/2" />
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 text-center">
          Failed to load session data: {error}
        </div>
      )}
      <AudioTimelinePage
        projectName={projectName}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onBack={handleBack}
        photos={sessionData?.photos}
        audioUrl={sessionData?.audioUrl ?? undefined}
        audioDurationSeconds={sessionData?.audioDurationSeconds ?? undefined}
      />
    </>
  );
}

