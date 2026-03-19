import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Button } from "@/frontend/pages/ui_components/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { SecureImage } from "@/frontend/pages/smart_components/SecureImage";
import {
  ArrowLeft,
  Play,
  Pause,
  Volume2,
  GripVertical,
  Clock,
  Mic,
  Check,
  Loader2,
  Camera,
  ImageIcon,
  Sparkles,
} from "lucide-react";
import { useState, useMemo, useRef, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Types for transcript segments and timeline photos
// ---------------------------------------------------------------------------

export interface TranscriptSegment {
  id: string | number;
  text: string;
  /** Seconds from start of recording when this segment begins */
  timestamp: number;
  /** Seconds from start of recording when this segment ends */
  endTime?: number;
  /** ID of a linked photo, if any */
  linkedPhotoId?: string | number | null;
  /** Direct thumbnail URL for convenience (avoids lookup) */
  photoThumbnailUrl?: string;
}

export interface TimelinePhoto {
  id: string | number;
  url: string;
  storagePath?: string;
  name?: string;
  /** Milliseconds from start of recording when photo was taken */
  takenAtMs: number;
}

export type ProcessingStatus = "idle" | "transcribing" | "matching" | "complete";

// ---------------------------------------------------------------------------
// API response shape
// ---------------------------------------------------------------------------

interface AudioTimelineApiResponse {
  sessionId: string | null;
  audioUrl: string | null;
  audioStoragePath: string | null;
  audioDurationSeconds: number | null;
  segments: Array<{ text: string; timestampMs: number }>;
  photos: TimelinePhoto[];
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface AudioTimelinePageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onBack: () => void;
  projectId: string | null;
  folderName: string | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const WAVEFORM_BARS = [
  20, 45, 30, 65, 40, 75, 35, 55, 80, 45, 60, 30, 70, 50, 85, 40, 60, 35, 75, 55,
  30, 65, 45, 80, 35, 55, 70, 40, 60, 50, 75, 35, 65, 45, 80, 30, 55, 70, 40, 60,
  50, 75, 35, 65, 45, 55, 30, 70, 40, 60,
];

function formatDuration(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function formatClockTime(sessionStart: Date, offsetSeconds: number) {
  const d = new Date(sessionStart.getTime() + offsetSeconds * 1000);
  return d
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .toLowerCase()
    .replace(" ", " ");
}

type TimelineItem =
  | { kind: "segment"; segment: TranscriptSegment; attachedPhotos: TimelinePhoto[] }
  | { kind: "photo"; photo: TimelinePhoto };

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
        if (!cancelled) setFetchError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [projectId, folderName]);

  const projectName = projectId ? `Project #${projectId}` : "Audio Timeline";
  const audioUrl = sessionData?.audioUrl ?? undefined;
  const audioDurationSeconds = sessionData?.audioDurationSeconds ?? undefined;
  const photos = sessionData?.photos;
  const segments: TranscriptSegment[] | undefined = useMemo(() => {
    if (!sessionData || sessionData.segments.length === 0) return undefined;
    const raw = sessionData.segments;
    const dur = sessionData.audioDurationSeconds;
    return raw.map((seg, idx) => ({
      id: `seg-${idx}`,
      text: seg.text,
      timestamp: seg.timestampMs / 1000,
      endTime:
        (idx < raw.length - 1
          ? raw[idx + 1].timestampMs
          : dur != null
            ? dur * 1000
            : seg.timestampMs + 10000) / 1000,
    }));
  }, [sessionData]);
  const processingStatus = (segments ? "complete" : undefined) as ProcessingStatus | undefined;
  const sessionStartTime: Date | undefined = undefined;
  const linkedSegmentCount = segments?.filter((s) => s.linkedPhotoId != null).length;
  const descriptions: Record<string | number, string> | undefined = undefined;

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const secs = audioDurationSeconds != null ? Number(audioDurationSeconds) : NaN;
    if (Number.isFinite(secs) && secs > 0) setDuration(secs);
  }, [audioDurationSeconds]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const syncDuration = () => {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
    };
    const onLoadedMetadata = () => syncDuration();
    const onTimeUpdate = () => setCurrentTime(audio.currentTime);
    const onEnded = () => setIsPlaying(false);

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);

    if (audio.readyState >= 1) {
      syncDuration();
      setCurrentTime(audio.currentTime);
    }

    const onDurationChange = () => syncDuration();
    audio.addEventListener("durationchange", onDurationChange);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("durationchange", onDurationChange);
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
    };
  }, [audioUrl]);

  const hasSegments = segments && segments.length > 0;
  const hasPhotos = photos && photos.length > 0;

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (!hasSegments) return [];

    const segs = segments!;
    const allPhotos = photos ?? [];

    const linkedPhotoIds = new Set<string | number>();

    const segmentItems: TimelineItem[] = segs.map((seg) => {
      const attached: TimelinePhoto[] = [];
      if (seg.linkedPhotoId != null) {
        const found = allPhotos.find((p) => p.id === seg.linkedPhotoId);
        if (found) {
          attached.push(found);
          linkedPhotoIds.add(found.id);
        }
      }
      return { kind: "segment" as const, segment: seg, attachedPhotos: attached };
    });

    const standalonePhotos: TimelineItem[] = allPhotos
      .filter((p) => !linkedPhotoIds.has(p.id))
      .map((p) => ({ kind: "photo" as const, photo: p }));

    const merged = [...segmentItems, ...standalonePhotos];
    merged.sort((a, b) => {
      const tA = a.kind === "segment" ? a.segment.timestamp : a.photo.takenAtMs / 1000;
      const tB = b.kind === "segment" ? b.segment.timestamp : b.photo.takenAtMs / 1000;
      return tA - tB;
    });

    return merged;
  }, [hasSegments, segments, photos]);

  // Photos sorted by time for center column and right grid
  const sortedPhotos = useMemo(() => {
    if (!hasPhotos) return [];
    return [...photos!].sort((a, b) => a.takenAtMs - b.takenAtMs);
  }, [hasPhotos, photos]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying((prev) => !prev);
      return;
    }
    if (audio.paused) {
      if (Number.isFinite(audio.duration)) setDuration(audio.duration);
      audio.play().catch(() => { });
      setIsPlaying(true);
    } else {
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const useClockTime = !!sessionStartTime;
  const renderTimestamp = (offsetSeconds: number) =>
    useClockTime
      ? formatClockTime(sessionStartTime!, offsetSeconds)
      : formatDuration(offsetSeconds);

  const status = processingStatus ?? (hasSegments ? "complete" : undefined);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
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
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="metadata" className="hidden" />
      )}
      <AppHeader
        currentPage="dashboard"
        onNavigate={onNavigate}
        onLogout={onLogout}
        pageTitle="Audio Timeline"
      />

      <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 max-w-[1800px]">
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

        {/* ---- Controls strip (playback + status + hint) ---- */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {/* Audio Playback */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Volume2 className="w-4 h-4 text-slate-700" />
                <span className="text-sm font-semibold text-slate-700">Audio Playback</span>
              </div>
              <Button
                className="w-full bg-theme-action-primary hover:bg-theme-action-primary-hover rounded-lg"
                size="sm"
                onClick={togglePlay}
                disabled={!audioUrl && duration === 0}
              >
                {isPlaying ? <Pause className="w-4 h-4 mr-1.5" /> : <Play className="w-4 h-4 mr-1.5" />}
                {isPlaying ? "Pause" : "Play"} Audio
              </Button>
              <div className="space-y-1.5">
                <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="absolute inset-y-0 left-0 bg-theme-action-primary transition-[width] duration-100"
                    style={{
                      width: duration > 0 ? `${(currentTime / duration) * 100}%` : "0%",
                    }}
                  />
                  {duration > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-theme-action-primary shadow-sm pointer-events-none"
                      style={{ left: `${(currentTime / duration) * 100}%` }}
                      aria-hidden
                    />
                  )}
                </div>
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{formatDuration(currentTime)}</span>
                  <span>
                    {Number.isFinite(duration) && duration > 0
                      ? formatDuration(duration)
                      : "0:00"}
                  </span>
                </div>
              </div>
              <div className="h-10 bg-slate-100 rounded flex items-end justify-around gap-px p-1">
                {WAVEFORM_BARS.map((height, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-blue-300 rounded-sm opacity-40"
                    style={{ height: `${height}%` }}
                  />
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Processing Status */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-4 space-y-2">
              <span className="text-sm font-semibold text-slate-700">Processing Status</span>

              <div className="flex items-center gap-2">
                {status === "transcribing" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
                ) : status === "matching" || status === "complete" ? (
                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-full flex-shrink-0" />
                )}
                <span className={`text-xs ${status && status !== "idle" ? "text-slate-900" : "text-slate-500"}`}>
                  Transcribing audio
                </span>
              </div>

              <div className="flex items-center gap-2">
                {status === "matching" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
                ) : status === "complete" ? (
                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-full flex-shrink-0" />
                )}
                <span className={`text-xs ${status === "matching" || status === "complete" ? "text-slate-900" : "text-slate-500"}`}>
                  Matching with photos
                </span>
              </div>

              {status === "complete" ? (
                <div className="bg-green-50 border border-green-200 rounded p-2">
                  <div className="flex items-center gap-1.5">
                    <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                    <p className="text-xs text-green-900">
                      Processing complete
                      {linkedSegmentCount != null && (
                        <span className="text-green-700">
                          {" "}· {linkedSegmentCount} segment{linkedSegmentCount !== 1 ? "s" : ""} linked
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 rounded p-2">
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <p className="text-xs text-slate-600">
                      {status === "transcribing"
                        ? "Transcribing audio..."
                        : status === "matching"
                          ? "Matching transcript with photos..."
                          : "Transcript not yet generated"}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Drag-to-adjust hint */}
          <Card className="rounded-xl shadow-sm border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <GripVertical className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-blue-900 mb-1">Drag to adjust</p>
                  <p className="text-xs text-blue-700">
                    Drag transcript segments up or down to reassign them to different photos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ================================================================
            THREE-COLUMN LAYOUT
            Col 1 (left)   = Timeline & Transcript
            Col 2 (center) = AI-generated descriptions per photo
            Col 3 (right)  = Session photo grid
        ================================================================ */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

          {/* ---- COLUMN 1: Timeline & Transcript ---- */}
          <div className="lg:col-span-3">
            <Card className="rounded-xl shadow-sm border-slate-200 sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Timeline &amp; Transcript</CardTitle>
              </CardHeader>
              <CardContent>
                {hasSegments ? (
                  <div className="relative max-h-[65vh] overflow-y-auto pr-1 -mr-1">
                    <div className="absolute left-[40px] top-0 bottom-0 w-px bg-slate-200" />

                    <div className="space-y-1">
                      {timelineItems.map((item) => {
                        if (item.kind === "segment") {
                          const seg = item.segment;
                          const ts = renderTimestamp(seg.timestamp);
                          const thumbUrl =
                            seg.photoThumbnailUrl ||
                            (item.attachedPhotos.length > 0 ? item.attachedPhotos[0].url : null);
                          const thumbStoragePath =
                            item.attachedPhotos.length > 0 ? item.attachedPhotos[0].storagePath : undefined;

                          return (
                            <div key={`seg-${seg.id}`} className="flex items-start gap-2">
                              <div className="w-[34px] flex-shrink-0 text-right pt-2">
                                <span className="text-[10px] text-slate-400 font-medium leading-none">
                                  {ts}
                                </span>
                              </div>
                              <div className="relative flex-shrink-0 flex items-start pt-2.5">
                                <div className="w-2 h-2 rounded-full bg-slate-300 ring-2 ring-white z-10" />
                              </div>
                              <div className="flex-1 min-w-0 pb-2">
                                <div className="bg-slate-100 rounded-lg p-2">
                                  <p className="text-xs text-slate-800 leading-relaxed">
                                    {seg.text}
                                  </p>
                                  {thumbUrl && (
                                    <div className="mt-1.5 flex gap-1.5 flex-wrap">
                                      {item.attachedPhotos.length > 0 ? (
                                        item.attachedPhotos.map((photo) => (
                                          <div key={photo.id} className="w-16 h-11 rounded overflow-hidden flex-shrink-0">
                                            <SecureImage
                                              src={photo.url}
                                              storagePath={photo.storagePath}
                                              alt={photo.name || "Photo"}
                                              className="w-full h-full object-cover"
                                            />
                                          </div>
                                        ))
                                      ) : (
                                        <div className="w-16 h-11 rounded overflow-hidden flex-shrink-0">
                                          <SecureImage
                                            src={thumbUrl}
                                            storagePath={thumbStoragePath}
                                            alt="Photo"
                                            className="w-full h-full object-cover"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        }

                        const photo = item.photo;
                        const ts = renderTimestamp(photo.takenAtMs / 1000);

                        return (
                          <div key={`photo-${photo.id}`} className="flex items-start gap-2">
                            <div className="w-[34px] flex-shrink-0 text-right pt-2">
                              <span className="text-[10px] text-slate-400 font-medium leading-none">
                                {ts}
                              </span>
                            </div>
                            <div className="relative flex-shrink-0 flex items-start pt-2.5">
                              <div className="w-2 h-2 rounded-full bg-blue-400 ring-2 ring-white z-10" />
                            </div>
                            <div className="flex-1 min-w-0 pb-2">
                              <div className="bg-blue-50 rounded-lg p-2 flex items-center gap-2">
                                <div className="w-12 h-8 rounded overflow-hidden flex-shrink-0">
                                  <SecureImage
                                    src={photo.url}
                                    storagePath={photo.storagePath}
                                    alt={photo.name || "Photo"}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                                <div className="flex items-center gap-1 text-[10px] text-blue-600">
                                  <Camera className="w-3 h-3" />
                                  <span>{photo.name || "Photo captured"}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Mic className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 font-medium mb-1">
                        No transcript available yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-[200px]">
                        Once audio is processed, transcript segments will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- COLUMN 2: AI-Generated Descriptions ---- */}
          <div className="lg:col-span-6">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Report Outline</CardTitle>
                <p className="text-xs text-slate-500">
                  Update photos to create your report.
                </p>
              </CardHeader>
              <CardContent>
                {hasPhotos ? (
                  <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
                    {sortedPhotos.map((photo, idx) => {
                      const desc = descriptions?.[photo.id];
                      const linkedSegs = segments?.filter(
                        (s) => s.linkedPhotoId === photo.id
                      );
                      const hasLinkedTranscript = linkedSegs && linkedSegs.length > 0;

                      return (
                        <div
                          key={photo.id}
                          className="border border-slate-200 rounded-lg overflow-hidden"
                        >
                          {/* Description content */}
                          <div className="p-4">
                            {desc ? (
                              <p className="text-sm text-slate-800 leading-relaxed">
                                {desc}
                              </p>
                            ) : hasLinkedTranscript ? (
                              <div className="space-y-2">
                                {linkedSegs!.map((seg) => (
                                  <p
                                    key={seg.id}
                                    className="text-sm text-slate-600 leading-relaxed italic"
                                  >
                                    {seg.text}
                                  </p>
                                ))}
                                <div className="flex items-center gap-1.5 mt-2">
                                  <Sparkles className="w-3.5 h-3.5 text-slate-400" />
                                  <span className="text-xs text-slate-400">
                                    AI description will be generated from this transcript
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col items-center py-4 text-center gap-2">
                                <Sparkles className="w-5 h-5 text-slate-300" />
                                <p className="text-sm text-slate-400">
                                  No description added yet
                                </p>
                                <p className="text-xs text-slate-400">
                                  Description will be generated from transcript &amp; photo context
                                </p>
                              </div>
                            )}
                          </div>

                          {/* Photo label bar */}
                          <div className="bg-slate-50 border-t border-slate-200 px-4 py-2 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <ImageIcon className="w-3.5 h-3.5 text-slate-500" />
                              <span className="text-xs font-medium text-slate-600">
                                Image +{idx + 1}
                              </span>
                              {photo.name && (
                                <span className="text-xs text-slate-400">
                                  · {photo.name}
                                </span>
                              )}
                            </div>
                            {hasLinkedTranscript && (
                              <span className="text-[10px] text-slate-400">
                                Audio +{linkedSegs!.length}
                              </span>
                            )}
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
                      <p className="text-slate-700 font-medium mb-1">
                        No descriptions yet
                      </p>
                      <p className="text-sm text-slate-500 max-w-sm">
                        AI-generated descriptions for each photo will appear here
                        once transcript processing is complete.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ---- COLUMN 3: Session Photo Grid ---- */}
          <div className="lg:col-span-3">
            <Card className="rounded-xl shadow-sm border-slate-200 sticky top-6">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Session Photos</CardTitle>
                {hasPhotos && (
                  <p className="text-xs text-slate-400">{photos!.length} photo{photos!.length !== 1 ? "s" : ""}</p>
                )}
              </CardHeader>
              <CardContent>
                {hasPhotos ? (
                  <div className="grid grid-cols-2 gap-2 max-h-[65vh] overflow-y-auto pr-1 -mr-1">
                    {sortedPhotos.map((photo) => (
                      <div
                        key={photo.id}
                        className="aspect-[4/3] rounded-lg overflow-hidden border border-slate-200"
                      >
                        <SecureImage
                          src={photo.url}
                          storagePath={photo.storagePath}
                          alt={photo.name || "Photo"}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center">
                      <Camera className="w-6 h-6 text-slate-400" />
                    </div>
                    <div>
                      <p className="text-sm text-slate-700 font-medium mb-1">
                        No photos yet
                      </p>
                      <p className="text-xs text-slate-500 max-w-[200px]">
                        Photos from the capture session will appear here.
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
