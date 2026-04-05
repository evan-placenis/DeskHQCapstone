import { AppHeader } from "@/components/layouts/app-header";
import { Page } from "@/app/pages/config/routes";
import { apiRoutes } from "@/lib/api-routes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SecureImage } from "@/components/ui/secure-image";
import { ArrowLeft, ImageIcon, Sparkles } from "lucide-react";
import { useState, useMemo, useEffect } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TimelinePhoto {
  id: string | number;
  url: string;
  storagePath?: string;
  name?: string;
  /** Milliseconds from start of recording when photo was taken */
  takenAtMs: number;
  /** From `project_images.audio_description` (per-photo field notes from capture audio probes). */
  audioDescription?: string | null;
}

/** Subset of GET audio-timeline JSON used by this page. */
interface AudioTimelineApiResponse {
  photos?: TimelinePhoto[];
}

interface AudioTimelinePageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onBack: () => void;
  projectId: string | null;
  folderName: string | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AudioTimelinePage({
  onNavigate,
  onLogout,
  onBack,
  projectId,
  folderName,
}: AudioTimelinePageProps) {
  const [sessionData, setSessionData] = useState<AudioTimelineApiResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId || !folderName) return;

    let cancelled = false;
    setLoading(true);
    setFetchError(null);

    fetch(apiRoutes.project.audioTimeline(String(projectId), folderName))
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
        if (!cancelled) setFetchError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [projectId, folderName]);

  const projectName = projectId ? `Project #${projectId}` : "Audio Timeline";
  const photos = sessionData?.photos;
  const hasPhotos = photos && photos.length > 0;

  const sortedPhotos = useMemo(() => {
    if (!hasPhotos) return [];
    return [...photos!].sort((a, b) => a.takenAtMs - b.takenAtMs);
  }, [hasPhotos, photos]);

  return (
    <div className="min-h-screen bg-slate-50">
      {loading && (
        <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-blue-100">
          <div className="h-full bg-blue-500 animate-pulse w-1/2" />
        </div>
      )}
      {fetchError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 text-center">
          Failed to load session data: {fetchError}
        </div>
      )}
      <AppHeader
        currentPage="dashboard"
        onNavigate={onNavigate}
        onLogout={onLogout}
        pageTitle="Audio Timeline"
      />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        <Button
          variant="ghost"
          className="mb-4 rounded-lg hover:bg-slate-100 text-sm sm:text-base h-10 sm:h-auto px-3 sm:px-4"
          onClick={onBack}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Project
        </Button>

        <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-white mb-2 text-xl sm:text-2xl lg:text-3xl font-bold">
                Audio Timeline
              </h1>
              <p className="text-white/90">{projectName}</p>
            </div>
          </div>
        </Card>

        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Field notes</CardTitle>
            <p className="text-xs text-slate-500">
              Per-photo notes from capture audio.
            </p>
          </CardHeader>
          <CardContent>
            {hasPhotos ? (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1 -mr-1">
                {sortedPhotos.map((photo, idx) => {
                  const audioDesc =
                    typeof photo.audioDescription === "string" && photo.audioDescription.trim().length > 0
                      ? photo.audioDescription.trim()
                      : null;

                  return (
                    <div
                      key={photo.id}
                      className="border border-slate-200 rounded-lg overflow-hidden"
                    >
                      <div className="p-4 flex flex-col sm:flex-row gap-4">
                        <div className="w-full sm:w-40 shrink-0 aspect-[4/3] rounded-lg overflow-hidden border border-slate-200 bg-slate-100">
                          <SecureImage
                            src={photo.url}
                            storagePath={photo.storagePath}
                            alt={photo.name || "Session photo"}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="flex-1 min-w-0">
                          {audioDesc ? (
                            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap">
                              {audioDesc}
                            </p>
                          ) : (
                            <div className="flex flex-col items-start py-1 gap-2">
                              <Sparkles className="w-5 h-5 text-slate-300" />
                              <p className="text-sm text-slate-400">No field note for this photo yet.</p>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center gap-2">
                        <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                        <span className="text-xs font-medium text-slate-600">
                          Photo {idx + 1}
                          {photo.name ? (
                            <span className="text-slate-400 font-normal"> · {photo.name}</span>
                          ) : null}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <div className="w-14 h-14 rounded-full bg-slate-100 flex items-center justify-center">
                  <Sparkles className="w-7 h-7 text-slate-400" />
                </div>
                <div>
                  <p className="text-slate-700 font-medium mb-1">No photos in this session</p>
                  <p className="text-sm text-slate-500 max-w-sm">
                    Photos from the capture folder will appear here with field notes when the audio pipeline has run.
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
