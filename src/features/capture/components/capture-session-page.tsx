"use client";
//sinan made this
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Mic, Loader2, CheckCircle2, Search, Plus, Check } from "lucide-react";
import { Project } from "@/lib/types";
import { supabase } from "@/lib/supabase-browser-client";
import { apiRoutes } from "@/lib/api-routes";
import * as tus from "tus-js-client";
import { captureIDB } from "../services/capture-idb";
import { CAPTURE_RECOVERY_ACTION_KEY } from "../services/capture-recovery-bridge";

type Step = "capture" | "choose-project" | "uploading" | "success";

interface TranscriptEntry {
  text: string;
  timestampMs: number;
}

interface CapturedPhoto {
  id: number;
  blob: Blob;
  takenAtMs: number;
  previewUrl: string;
}

function isUsableImageBlob(blob: unknown): blob is Blob {
  return (
    blob instanceof Blob &&
    blob.size > 0 &&
    typeof blob.type === "string" &&
    blob.type.startsWith("image/")
  );
}

export function CaptureSessionPage({
  onClose,
  onSuccessRedirect,
}: {
  onClose: () => void;
  onSuccessRedirect: (projectId: string) => void;
}) {
  const [step, setStep] = useState<Step>("capture");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioStartTimeMs, setAudioStartTimeMs] = useState<number>(0);
  const [durationSec, setDurationSec] = useState(0);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const [needsNewSession, setNeedsNewSession] = useState(false);

  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoIdRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const recordingStartMsRef = useRef<number>(0);
  const isRecordingRef = useRef(false);
  /** Set when user chose "Retry Upload" from the global recovery gate (sessionStorage). */
  const shouldAutoRetryUploadRef = useRef(false);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createClientName, setCreateClientName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const supportedMimeType = useCallback(() => {
    if (typeof MediaRecorder === "undefined") return null;
    if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
    if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recovered = await captureIDB.getRecoverableSession();
        if (recovered && !cancelled) {
          const { session, photos: idbPhotos } = recovered;
          setSessionId(session.sessionId);
          setFolderName(session.folderName);
          if (session.projectId) setSelectedProjectId(session.projectId);
          if (session.transcriptEntries?.length) {
            setTranscriptEntries(session.transcriptEntries);
          }
          const validPhotos = idbPhotos.filter((p) => isUsableImageBlob(p.blob));
          const invalidPhotos = idbPhotos.filter((p) => !isUsableImageBlob(p.blob));
          if (invalidPhotos.length > 0) {
            Promise.all(
              invalidPhotos.map((p) => captureIDB.removePhoto(session.sessionId, p.photoId))
            ).catch(() => {});
          }

          const restoredPhotos = validPhotos.map((p) => ({
            id: p.photoId,
            blob: p.blob,
            takenAtMs: p.takenAtMs,
            previewUrl: URL.createObjectURL(p.blob),
          }));
          setPhotos(restoredPhotos);
          photoIdRef.current = Math.max(0, ...validPhotos.map((p) => p.photoId));

          let action: string | null = null;
          try {
            action = sessionStorage.getItem(CAPTURE_RECOVERY_ACTION_KEY);
            if (action) sessionStorage.removeItem(CAPTURE_RECOVERY_ACTION_KEY);
          } catch {
            /* ignore */
          }

          if (action === "retry-upload" && session.projectId) {
            shouldAutoRetryUploadRef.current = true;
            setStep("uploading");
          } else {
            setStep("capture");
          }
          return;
        }
      } catch (e) {
        console.warn("IDB recovery check failed:", e);
      }
      if (!cancelled) setNeedsNewSession(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!needsNewSession) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(apiRoutes.captureSessions.root, { method: "POST" });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.sessionId && data.folderName) {
        setSessionId(data.sessionId);
        setFolderName(data.folderName);
        setNeedsNewSession(false);
        captureIDB.saveSession({
          sessionId: data.sessionId,
          folderName: data.folderName,
          step: "capture",
          projectId: null,
          finalized: false,
          audioUploaded: false,
          metadataSent: false,
          transcriptEntries: [],
          createdAt: Date.now(),
        }).catch((e) => console.warn("IDB save failed:", e));
      }
    })();
    return () => { cancelled = true; };
  }, [needsNewSession]);

  useEffect(() => {
    if (!sessionId || step !== "capture") return;
    const streamPromise = navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
      audio: true,
    });
    streamPromise
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera/mic access denied.");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [sessionId, step]);

  const startRecording = useCallback(() => {
    const mime = supportedMimeType();
    if (!mime || !streamRef.current) return;
    const audioTrack = streamRef.current.getAudioTracks()[0];
    const audioStream = audioTrack ? new MediaStream([audioTrack]) : new MediaStream();
    const recorder = new MediaRecorder(audioStream, { mimeType: mime });
    audioChunksRef.current = [];
    recorder.ondataavailable = (e) => e.data.size && audioChunksRef.current.push(e.data);
    recorder.start(1000);
    mediaRecorderRef.current = recorder;

    const startMs = Date.now();
    recordingStartMsRef.current = startMs;
    setAudioStartTimeMs(startMs);
    setDurationSec(0);
    setTranscriptEntries([]);
    durationIntervalRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
    setIsRecording(true);
    isRecordingRef.current = true;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognitionCtor) {
      const recognition = new SpeechRecognitionCtor();
      recognition.continuous = true;
      recognition.interimResults = false;
      recognition.lang = "en-US";

      const fatalErrors = new Set(["not-allowed", "service-not-allowed", "aborted"]);
      recognition.onerror = (e: any) => {
        if (fatalErrors.has(e.error)) {
          isRecordingRef.current = false;
        }
        if (e.error !== "no-speech") console.warn("SpeechRecognition error:", e.error);
      };

      recognition.onend = () => {
        if (isRecordingRef.current && recognitionRef.current === recognition) {
          setTimeout(() => recognition.start(), 100);
        }
      };

      recognition.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          if (event.results[i].isFinal) {
            const text = event.results[i][0].transcript.trim();
            if (text) {
              setTranscriptEntries((prev) => [
                ...prev,
                { text, timestampMs: Date.now() - recordingStartMsRef.current },
              ]);
            }
          }
        }
      };

      recognition.start();
      recognitionRef.current = recognition;
    }
  }, [supportedMimeType]);

  const stopRecording = useCallback(() => {
    isRecordingRef.current = false;
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setIsRecording(false);
  }, []);

  const takePhoto = useCallback(() => {
    const video = videoRef.current;
    if (!video || !sessionId || video.readyState < 2) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!isUsableImageBlob(blob)) return;
        const takenAtMs = audioStartTimeMs ? Date.now() - audioStartTimeMs : 0;
        const id = ++photoIdRef.current;
        setPhotos((prev) => [
          ...prev,
          {
            id,
            blob,
            takenAtMs,
            previewUrl: URL.createObjectURL(blob),
          },
        ]);
        captureIDB.savePhoto(sessionId!, id, blob, takenAtMs)
          .catch((e) => console.warn("IDB photo save failed:", e));
      },
      "image/jpeg",
      0.9
    );
  }, [sessionId, audioStartTimeMs]);

  const removePhoto = useCallback((id: number) => {
    setPhotos((prev) => {
      const p = prev.find((x) => x.id === id);
      if (p?.previewUrl) URL.revokeObjectURL(p.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
    if (sessionId) {
      captureIDB.removePhoto(sessionId, id)
        .catch((e) => console.warn("IDB photo remove failed:", e));
    }
  }, [sessionId]);

  const handleDone = useCallback(() => {
    stopRecording();
    setStep("choose-project");
    if (sessionId) {
      captureIDB.updateSession(sessionId, {
        step: "choose-project",
        transcriptEntries,
      }).catch((e) => console.warn("IDB session update failed:", e));
    }
    setProjectsLoading(true);
    fetch(apiRoutes.project.list())
      .then((r) => r.json())
      .then((data) => (data.projects ? setProjects(data.projects) : null))
      .catch(() => { })
      .finally(() => setProjectsLoading(false));
  }, [stopRecording, sessionId, transcriptEntries]);

  const handleCreateProject = useCallback(async () => {
    if (!createName.trim()) return;
    setCreateSubmitting(true);
    try {
      const res = await fetch(apiRoutes.project.create, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim(),
          clientName: createClientName.trim() || undefined,
          address: createAddress.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.project?.id) {
        setProjects((prev) => [...prev, { id: data.project.id, name: data.project.name, status: data.project.status || "Active", reports: 0, photos: 0, lastUpdated: new Date().toISOString().split("T")[0] }]);
        setSelectedProjectId(data.project.id);
        setCreateProjectOpen(false);
        setCreateName("");
        setCreateClientName("");
        setCreateAddress("");
      }
    } finally {
      setCreateSubmitting(false);
    }
  }, [createName, createClientName, createAddress]);

  const getAudioBlob = useCallback(() => {
    if (audioChunksRef.current.length === 0) return null;
    const mime = supportedMimeType();
    return new Blob(audioChunksRef.current, { type: mime || "audio/webm" });
  }, [supportedMimeType]);

  const doUpload = useCallback(async () => {
    const projectId = selectedProjectId;
    if (!sessionId || !projectId) return;
    setStep("uploading");
    setUploadError(null);
    setUploadProgress("uploading");

    try {
      await captureIDB.updateSession(sessionId, { step: "uploading", projectId }).catch(() => {});

      const idbState = await captureIDB.getSession(sessionId).catch(() => null);

      // 1. Finalize session (idempotent — safe to call again on retry)
      const finalizeRes = await fetch(apiRoutes.captureSessions.finalize(sessionId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({}));
        throw new Error(err.error || "Finalize failed");
      }
      const finalizeData = await finalizeRes.json();
      const { organizationId, folderName: fn } = finalizeData;
      await captureIDB.updateSession(sessionId, { finalized: true }).catch(() => {});

      // 2. Audio via TUS (skip if already uploaded in a previous attempt)
      const audioBlob = getAudioBlob();
      let audioClientUploaded = idbState?.audioUploaded === true;

      if (!audioClientUploaded && audioBlob && audioBlob.size > 0 && organizationId && fn) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (!token) throw new Error("Not authenticated. Please log in to upload audio.");

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!supabaseUrl) throw new Error("Missing Supabase configuration.");

        const safeFolder = fn.replace(/\//g, "-");
        const fileName = `session-audio-${sessionId}.webm`;
        const filePath = `${organizationId}/${projectId}/${safeFolder}/${fileName}`;
        const CHUNK_SIZE = 6 * 1024 * 1024;
        const mimeType = audioBlob.type || "audio/webm";

        await new Promise<void>((resolve, reject) => {
          const upload = new tus.Upload(audioBlob, {
            endpoint: `${supabaseUrl}/storage/v1/upload/resumable`,
            retryDelays: [0, 3000, 5000, 10000, 20000],
            headers: {
              authorization: `Bearer ${token}`,
              "x-upsert": "false",
            },
            uploadDataDuringCreation: true,
            removeFingerprintOnSuccess: true,
            chunkSize: CHUNK_SIZE,
            metadata: {
              bucketName: "project-audio",
              objectName: filePath,
              contentType: mimeType,
              cacheControl: "3600",
            },
            onError(error: unknown) {
              reject(new Error(`Audio upload failed: ${error instanceof Error ? error.message : String(error)}`));
            },
            onSuccess() {
              resolve();
            },
          });
          upload.start();
        });
        audioClientUploaded = true;
        await captureIDB.updateSession(sessionId, { audioUploaded: true }).catch(() => {});
      }

      // 3. Upload photos one at a time (only those not yet uploaded)
      let photosToUpload: { photoId: number; blob: Blob; takenAtMs: number }[];
      try {
        const allIDB = await captureIDB.getPhotos(sessionId);
        if (allIDB.length > 0) {
          photosToUpload = allIDB
            .filter((p) => !p.uploaded)
            .filter((p) => isUsableImageBlob(p.blob))
            .map((p) => ({ photoId: p.photoId, blob: p.blob, takenAtMs: p.takenAtMs }));
        } else {
          photosToUpload = photos
            .filter((p) => isUsableImageBlob(p.blob))
            .map((p) => ({ photoId: p.id, blob: p.blob, takenAtMs: p.takenAtMs }));
        }
      } catch {
        photosToUpload = photos
          .filter((p) => isUsableImageBlob(p.blob))
          .map((p) => ({ photoId: p.id, blob: p.blob, takenAtMs: p.takenAtMs }));
      }

      setTotalUploadCount(photosToUpload.length);
      setUploadedCount(0);

      for (let i = 0; i < photosToUpload.length; i++) {
        const photo = photosToUpload[i];
        const form = new FormData();
        form.append("photos", photo.blob, `photo-${photo.photoId}.jpg`);
        form.append("taken_at_ms", String(photo.takenAtMs));

        const res = await fetch(apiRoutes.captureSessions.upload(sessionId), {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Photo upload failed (${i + 1}/${photosToUpload.length})`);
        }

        await captureIDB.markPhotoUploaded(sessionId, photo.photoId).catch(() => {});
        setUploadedCount(i + 1);
      }

      // 4. Send metadata (transcript + audio flag) once after all photos
      const currentTranscript = idbState?.transcriptEntries?.length
        ? idbState.transcriptEntries
        : transcriptEntries;

      if (
        !(idbState?.metadataSent === true) &&
        (audioClientUploaded || currentTranscript.length > 0)
      ) {
        const form = new FormData();
        if (audioClientUploaded) form.set("audioClientUploaded", "true");
        if (currentTranscript.length > 0) {
          form.set("transcript_segments", JSON.stringify(currentTranscript));
        }
        const metaRes = await fetch(apiRoutes.captureSessions.upload(sessionId), {
          method: "POST",
          body: form,
        });
        if (!metaRes.ok) {
          const err = await metaRes.json().catch(() => ({}));
          throw new Error(err.error || "Failed to save session metadata");
        }
        await captureIDB.updateSession(sessionId, { metadataSent: true }).catch(() => {});
      }

      // 5. Done — clear local persistence
      await captureIDB.clearSession(sessionId).catch(() => {});
      setUploadProgress("done");
      setStep("success");
      setTimeout(() => onSuccessRedirect(projectId), 1500);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress("error");
    }
  }, [sessionId, selectedProjectId, photos, transcriptEntries, getAudioBlob, onSuccessRedirect]);

  useEffect(() => {
    if (!shouldAutoRetryUploadRef.current) return;
    if (!sessionId || !selectedProjectId) return;
    shouldAutoRetryUploadRef.current = false;
    void doUpload();
  }, [sessionId, selectedProjectId, doUpload]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const loadProjectsAndGo = useCallback(() => {
    setStep("choose-project");
    setProjectsLoading(true);
    fetch(apiRoutes.project.list())
      .then((r) => r.json())
      .then((data) => (data.projects ? setProjects(data.projects) : null))
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, []);

  if (!sessionId && step === "capture") {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }

  if (step === "choose-project") {
    return (
      <div className="fixed inset-0 bg-slate-50 z-50 flex flex-col safe-area-inset">
        <div className="flex items-center justify-between p-3 border-b bg-white">
          <Button variant="ghost" size="sm" onClick={() => setStep("capture")} className="rounded-lg">
            <X className="w-5 h-5" />
          </Button>
          <h1 className="font-semibold text-slate-900">Choose Project</h1>
          <div className="w-10" />
        </div>
        <div className="p-3 flex-1 overflow-auto">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects..."
              className="pl-9 rounded-lg"
            />
          </div>
          {createProjectOpen ? (
            <div className="border rounded-xl p-4 mb-4 bg-white space-y-3">
              <Input
                placeholder="Project name *"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                className="rounded-lg"
              />
              <Input
                placeholder="Client name"
                value={createClientName}
                onChange={(e) => setCreateClientName(e.target.value)}
                className="rounded-lg"
              />
              <Input
                placeholder="Address"
                value={createAddress}
                onChange={(e) => setCreateAddress(e.target.value)}
                className="rounded-lg"
              />
              <div className="flex gap-2">
                <Button variant="outline" className="rounded-lg flex-1" onClick={() => setCreateProjectOpen(false)}>
                  Cancel
                </Button>
                <Button className="rounded-lg flex-1 bg-theme-action-primary" onClick={handleCreateProject} disabled={!createName.trim() || createSubmitting}>
                  {createSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Create"}
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full rounded-lg border-dashed border-theme-primary text-theme-primary mb-4"
              onClick={() => setCreateProjectOpen(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              Create New Project
            </Button>
          )}
          {projectsLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map((p) => {
                const isSelected = selectedProjectId === String(p.id);
                return (
                  <button
                    key={String(p.id)}
                    onClick={() => setSelectedProjectId(String(p.id))}
                    className={`w-full p-3 rounded-xl border-2 text-left transition-all flex items-center justify-between ${isSelected
                        ? "border-theme-action-primary bg-theme-primary/15 ring-2 ring-theme-action-primary/50 shadow-sm"
                        : "border-slate-200 hover:border-slate-300"
                      }`}
                  >
                    <div>
                      <span className="font-medium text-slate-900">{p.name}</span>
                      <span className="block text-xs text-slate-500">{p.status}</span>
                    </div>
                    {isSelected && (
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-theme-action-primary flex items-center justify-center">
                        <Check className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        <div className="p-3 border-t bg-white">
          <Button
            className="w-full rounded-lg bg-theme-action-primary"
            disabled={!selectedProjectId}
            onClick={doUpload}
          >
            Upload {photos.length} photo{photos.length !== 1 ? "s" : ""} & finish
          </Button>
        </div>
      </div>
    );
  }

  if (step === "uploading" || step === "success") {
    return (
      <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col items-center justify-center p-6">
        {step === "success" ? (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-500 mb-4" />
            <p className="text-white text-lg">Upload complete. Redirecting...</p>
          </>
        ) : uploadProgress === "error" ? (
          <>
            <p className="text-red-400 text-center mb-2">{uploadError}</p>
            {uploadedCount > 0 && (
              <p className="text-slate-400 text-sm mb-4">
                {uploadedCount} of {uploadedCount + (totalUploadCount - uploadedCount)} photos saved.
                {totalUploadCount - uploadedCount > 0
                  ? ` ${totalUploadCount - uploadedCount} remaining.`
                  : ""}
              </p>
            )}
            <Button className="rounded-lg bg-theme-action-primary mb-2" onClick={doUpload}>
              Retry Upload
            </Button>
            <Button variant="ghost" className="rounded-lg text-slate-400" onClick={() => setStep("choose-project")}>
              Back
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-theme-primary mb-4" />
            <p className="text-white">
              {totalUploadCount > 0
                ? `Uploading photo ${Math.min(uploadedCount + 1, totalUploadCount)} of ${totalUploadCount}...`
                : "Uploading..."}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900 z-50 flex flex-col safe-area-inset">
      <div className="flex items-center justify-between p-3 bg-slate-900/95 border-b border-slate-700">
        <Button variant="ghost" size="sm" onClick={onClose} className="text-white hover:bg-slate-800 rounded-lg h-9">
          <X className="w-5 h-5" />
        </Button>
        <div className="flex items-center gap-3">
          <span className="text-white font-medium">Capture Session</span>
          <span className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-800 rounded-full text-white text-sm">
            <Camera className="w-4 h-4 text-theme-primary" />
            {photos.length}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDone}
          disabled={photos.length === 0}
          className="text-theme-primary hover:bg-slate-800 rounded-lg h-9 px-4 disabled:opacity-50"
        >
          Done
        </Button>
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white font-mono text-sm">{formatDuration(durationSec)}</span>
        </div>
      )}

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 relative bg-black min-h-0">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          {cameraError && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-900/90 p-6">
              <p className="text-slate-300 text-center">{cameraError}</p>
            </div>
          )}
          {!cameraError && (
            <div className="absolute bottom-6 left-0 right-0 flex justify-center">
              {!isRecording ? (
                <Button
                  onClick={startRecording}
                  className="w-14 h-14 rounded-full bg-theme-action-primary hover:bg-theme-action-primary-hover"
                >
                  <Mic className="w-6 h-6" />
                </Button>
              ) : (
                <>
                  <button
                    onClick={takePhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-xl flex items-center justify-center active:scale-95"
                  >
                    <div className="w-14 h-14 rounded-full bg-white" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
        {photos.length > 0 && (
          <div className="flex gap-2 p-3 bg-slate-900/95 border-t border-slate-700 overflow-x-auto">
            {photos.map((p) => (
              <div key={p.id} className="relative flex-shrink-0">
                <img src={p.previewUrl} alt="" className="w-16 h-16 object-cover rounded-lg border border-slate-600" />
                <button
                  onClick={() => removePhoto(p.id)}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
