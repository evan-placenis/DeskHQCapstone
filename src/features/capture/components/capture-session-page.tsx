"use client";
import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Camera, X, Mic, Loader2, CheckCircle2, Search, Plus, Check, Pause, Play } from "lucide-react";
import { Project } from "@/lib/types";
import { supabase } from "@/lib/supabase-browser-client";
import { apiRoutes } from "@/lib/api-routes";
import * as tus from "tus-js-client";
import { captureIDB } from "../services/capture-idb";
import { pickSupportedAudioMimeType, useCaptureSession } from "../hooks/use-capture-session";
import { CAPTURE_RECOVERY_ACTION_KEY } from "../services/capture-recovery-bridge";
import { saveImageBlobsToDeviceViaShare } from "@/features/projects/utils/save-photos-to-device";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

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
  if (!(blob instanceof Blob) || blob.size === 0) return false;
  if (typeof blob.type === "string" && blob.type.startsWith("image/")) return true;
  // After IDB round-trip some browsers lose the MIME type; accept any non-empty blob
  // that was originally validated on capture.
  if (!blob.type || blob.type === "") return true;
  return false;
}

/**
 * Materialize a fresh Blob for multipart upload. IndexedDB-backed Blobs sometimes
 * report a non-zero size but read as empty when sent over fetch on Safari/iOS.
 */
function materializeImageBlobForUpload(blob: Blob): Blob | null {
  if (!(blob instanceof Blob) || blob.size === 0) return null;
  const type = blob.type || "image/jpeg";
  return blob.slice(0, blob.size, type);
}

function preparePhotosForUpload(
  rows: { photoId: number; blob: Blob; takenAtMs: number }[]
): { ready: { photoId: number; blob: Blob; takenAtMs: number }[]; invalidPhotoIds: number[] } {
  const ready: { photoId: number; blob: Blob; takenAtMs: number }[] = [];
  const invalidPhotoIds: number[] = [];
  for (const row of rows) {
    const typed = row.blob.type ? row.blob : new Blob([row.blob], { type: "image/jpeg" });
    const blob = materializeImageBlobForUpload(typed);
    if (!blob || blob.size === 0) {
      console.error("CRITICAL: Attempted to upload an empty or missing photo blob!", row);
      invalidPhotoIds.push(row.photoId);
      continue;
    }
    ready.push({ photoId: row.photoId, blob, takenAtMs: row.takenAtMs });
  }
  return { ready, invalidPhotoIds };
}

export function CaptureSessionPage({
  onClose,
  onSuccessRedirect,
}: {
  onClose: () => void;
  onSuccessRedirect: () => void;
}) {
  const [step, setStep] = useState<Step>("capture");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [folderName, setFolderName] = useState<string | null>(null);
  const [photos, setPhotos] = useState<CapturedPhoto[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [totalUploadCount, setTotalUploadCount] = useState(0);
  const [needsNewSession, setNeedsNewSession] = useState(false);

  const [transcriptEntries, setTranscriptEntries] = useState<TranscriptEntry[]>([]);

  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createClientName, setCreateClientName] = useState("");
  const [createAddress, setCreateAddress] = useState("");
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [postDoneSavePromptOpen, setPostDoneSavePromptOpen] = useState(false);
  const [postDoneSaveBusy, setPostDoneSaveBusy] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [captureStream, setCaptureStream] = useState<MediaStream | null>(null);
  const photoIdRef = useRef(0);
  const recognitionRef = useRef<any>(null);
  const isRecordingRef = useRef(false);
  const isPausedRef = useRef(false);
  /** Set when user chose "Retry Upload" from the global recovery gate (sessionStorage). */
  const shouldAutoRetryUploadRef = useRef(false);
  const photosRef = useRef<CapturedPhoto[]>([]);
  /** Final merged audio after Done (used for TUS upload and retry). */
  const finalizedAudioBlobRef = useRef<Blob | null>(null);
  /** Merged blob from IDB when the hook has not been hydrated yet (e.g. choose-project / upload-only recovery). */
  const recoveryAudioBlobRef = useRef<Blob | null>(null);
  const pendingRecoveryHydrateRef = useRef<{
    chunks: Blob[];
    mimeType: string;
    durationMs: number;
    nextChunkIndex: number;
  } | null>(null);

  const onAudioChunkPersist = useCallback(
    (payload: {
      chunkIndex: number;
      blob: Blob;
      encodedDurationMs: number;
      mimeType: string;
    }) => {
      if (!sessionId) return;
      captureIDB.saveAudioChunk(sessionId, payload.chunkIndex, payload.blob).catch(() => {});
      captureIDB
        .updateSession(sessionId, {
          localAudioCaptured: true,
          audioEncodedDurationMs: payload.encodedDurationMs,
          audioMimeType: payload.mimeType,
        })
        .catch(() => {});
    },
    [sessionId]
  );

  const onFreshSessionStart = useCallback(() => {
    if (sessionId) {
      captureIDB.clearAudioChunks(sessionId).catch(() => {});
    }
  }, [sessionId]);

  const {
    isRecording,
    isPaused,
    durationSec,
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    getEncodedTimelineMs,
    hydrateFromRecovery,
    getMergedAudioBlob,
    getChunkCount,
  } = useCaptureSession(captureStream, {
    onAudioChunkPersist,
    onFreshSessionStart,
  });

  useEffect(() => { photosRef.current = photos; }, [photos]);

  useEffect(() => {
    isRecordingRef.current = isRecording;
  }, [isRecording]);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  useEffect(() => {
    if (!sessionId) return;
    const t = setTimeout(() => {
      captureIDB.updateSession(sessionId, { transcriptEntries }).catch(() => {});
    }, 400);
    return () => clearTimeout(t);
  }, [sessionId, transcriptEntries]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const recovered = await captureIDB.getRecoverableSession();
        if (recovered && !cancelled) {
          const { session, photos: idbPhotos } = recovered;
          await captureIDB.deleteAllSessionsExcept(session.sessionId);
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

          try {
            const { blobs: audioChunks, nextChunkIndex } =
              await captureIDB.getAudioChunksWithMeta(session.sessionId);
            if (audioChunks.length > 0) {
              const mime =
                session.audioMimeType || pickSupportedAudioMimeType() || "audio/webm";
              const durationMs = session.audioEncodedDurationMs ?? 0;
              recoveryAudioBlobRef.current = new Blob(audioChunks, { type: mime });
              pendingRecoveryHydrateRef.current = {
                chunks: audioChunks,
                mimeType: mime,
                durationMs,
                nextChunkIndex,
              };
            }
          } catch (e) {
            console.warn("IDB audio recovery load failed:", e);
          }

          let action: string | null = null;
          try {
            action = sessionStorage.getItem(CAPTURE_RECOVERY_ACTION_KEY);
            if (action) sessionStorage.removeItem(CAPTURE_RECOVERY_ACTION_KEY);
          } catch {
            /* ignore */
          }

          if (
            (action === "retry-upload" && session.projectId) ||
            (session.step === "uploading" && session.projectId)
          ) {
            shouldAutoRetryUploadRef.current = true;
            setStep("uploading");
          } else if (session.step === "choose-project") {
            setStep("choose-project");
            setProjectsLoading(true);
            fetch(apiRoutes.project.list())
              .then((r) => r.json())
              .then((data) => (data.projects ? setProjects(data.projects) : null))
              .catch(() => {})
              .finally(() => setProjectsLoading(false));
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
      try {
        await captureIDB.clearAllCaptureData();
      } catch (e) {
        console.warn("IDB clear before new session failed:", e);
      }
      if (cancelled) return;
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
          localAudioCaptured: false,
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
        setCaptureStream(stream);
        if (videoRef.current) videoRef.current.srcObject = stream;
        setCameraError(null);
      })
      .catch((err) => {
        setCameraError(err?.message || "Camera/mic access denied.");
      });
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setCaptureStream(null);
    };
  }, [sessionId, step]);

  useEffect(() => {
    if (!captureStream || !sessionId || step !== "capture") return;
    const pending = pendingRecoveryHydrateRef.current;
    if (!pending) return;
    pendingRecoveryHydrateRef.current = null;
    hydrateFromRecovery(
      pending.chunks,
      pending.mimeType,
      pending.durationMs,
      pending.nextChunkIndex
    );
    recoveryAudioBlobRef.current = null;
  }, [captureStream, sessionId, step, hydrateFromRecovery]);

  const startSpeechRecognition = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;

    const SpeechRecognitionCtor =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionCtor) return;

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
      if (
        isRecordingRef.current &&
        !isPausedRef.current &&
        recognitionRef.current === recognition
      ) {
        setTimeout(() => {
          try {
            recognition.start();
          } catch {
            /* ignore */
          }
        }, 100);
      }
    };

    recognition.onresult = (event: any) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const text = event.results[i][0].transcript.trim();
          if (text) {
            const timestampMs = getEncodedTimelineMs();
            setTranscriptEntries((prev) => [...prev, { text, timestampMs }]);
          }
        }
      }
    };

    try {
      recognition.start();
    } catch {
      /* ignore */
    }
    recognitionRef.current = recognition;
  }, [getEncodedTimelineMs]);

  const startCapture = useCallback(() => {
    if (!captureStream) return;
    if (pendingRecoveryHydrateRef.current) {
      const p = pendingRecoveryHydrateRef.current;
      pendingRecoveryHydrateRef.current = null;
      hydrateFromRecovery(
        p.chunks,
        p.mimeType,
        p.durationMs,
        p.nextChunkIndex
      );
      recoveryAudioBlobRef.current = null;
    }
    const cont = getChunkCount() > 0;
    if (!cont) {
      finalizedAudioBlobRef.current = null;
      recoveryAudioBlobRef.current = null;
      setTranscriptEntries([]);
    }
    startSession({ continue: cont });
    isRecordingRef.current = true;
    startSpeechRecognition();
  }, [
    captureStream,
    hydrateFromRecovery,
    getChunkCount,
    startSession,
    startSpeechRecognition,
  ]);

  const pauseCapture = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    pauseSession();
  }, [pauseSession]);

  const resumeCapture = useCallback(() => {
    resumeSession();
    startSpeechRecognition();
  }, [resumeSession, startSpeechRecognition]);

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
        const takenAtMs = getEncodedTimelineMs();
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
  }, [sessionId, getEncodedTimelineMs]);

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

  const proceedToChooseProject = useCallback(() => {
    setPostDoneSavePromptOpen(false);
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
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, [sessionId, transcriptEntries]);

  const handlePostDoneSaveYes = useCallback(async () => {
    setPostDoneSaveBusy(true);
    try {
      const blobs = photos.filter((p) => isUsableImageBlob(p.blob)).map((p) => p.blob);
      if (blobs.length > 0) {
        await saveImageBlobsToDeviceViaShare(blobs);
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        console.error("Save to device after capture:", err);
        alert(
          err instanceof Error
            ? err.message
            : "Could not open the share dialog. You can continue without saving copies."
        );
      }
    } finally {
      setPostDoneSaveBusy(false);
      proceedToChooseProject();
    }
  }, [photos, proceedToChooseProject]);

  const handleDone = useCallback(async () => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    isRecordingRef.current = false;

    if (isRecording) {
      const blob = await endSession();
      finalizedAudioBlobRef.current = blob.size > 0 ? blob : null;
      if (sessionId && finalizedAudioBlobRef.current) {
        captureIDB.updateSession(sessionId, { localAudioCaptured: true }).catch(() => {});
      }
    } else {
      const merged = getMergedAudioBlob() ?? recoveryAudioBlobRef.current;
      finalizedAudioBlobRef.current = merged && merged.size > 0 ? merged : null;
    }

    if (photos.length === 0) {
      proceedToChooseProject();
      return;
    }
    setPostDoneSavePromptOpen(true);
  }, [isRecording, endSession, getMergedAudioBlob, sessionId, photos.length, proceedToChooseProject]);

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
    if (finalizedAudioBlobRef.current) return finalizedAudioBlobRef.current;
    const hookBlob = getMergedAudioBlob();
    if (hookBlob && hookBlob.size > 0) return hookBlob;
    return recoveryAudioBlobRef.current;
  }, [getMergedAudioBlob]);

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
      const currentPhotos = photosRef.current;
      let photosToUpload: { photoId: number; blob: Blob; takenAtMs: number }[];
      try {
        const allIDB = await captureIDB.getPhotos(sessionId);
        if (allIDB.length > 0) {
          photosToUpload = allIDB
            .filter((p) => !p.uploaded)
            .filter((p) => isUsableImageBlob(p.blob))
            .map((p) => ({
              photoId: p.photoId,
              blob: p.blob.type ? p.blob : new Blob([p.blob], { type: "image/jpeg" }),
              takenAtMs: p.takenAtMs,
            }));
        } else {
          photosToUpload = currentPhotos
            .filter((p) => isUsableImageBlob(p.blob))
            .map((p) => ({ photoId: p.id, blob: p.blob, takenAtMs: p.takenAtMs }));
        }
      } catch {
        photosToUpload = currentPhotos
          .filter((p) => isUsableImageBlob(p.blob))
          .map((p) => ({ photoId: p.id, blob: p.blob, takenAtMs: p.takenAtMs }));
      }

      const { ready: photosReady, invalidPhotoIds } = preparePhotosForUpload(photosToUpload);
      for (const id of invalidPhotoIds) {
        void captureIDB.removePhoto(sessionId, id).catch(() => {});
      }
      if (photosReady.length === 0 && photosToUpload.length > 0) {
        throw new Error(
          "Photos could not be read for upload (they may have been cleared from browser storage). Try capturing again."
        );
      }

      setTotalUploadCount(photosReady.length);
      setUploadedCount(0);

      for (let i = 0; i < photosReady.length; i++) {
        const photo = photosReady[i];
        if (!photo.blob || photo.blob.size === 0) {
          console.error("CRITICAL: Attempted to upload an empty or missing photo blob!", photo);
          throw new Error(
            "A photo was empty right before upload. Please go back and capture your photos again."
          );
        }
        const form = new FormData();
        form.append("photos", photo.blob, `photo-${photo.photoId}.jpg`);
        form.append("taken_at_ms", String(photo.takenAtMs));

        const res = await fetch(apiRoutes.captureSessions.upload(sessionId), {
          method: "POST",
          body: form,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || `Photo upload failed (${i + 1}/${photosReady.length})`);
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

      // 5. Done — mark success first (so recovery gate won't re-trigger), then clear
      await captureIDB.updateSession(sessionId, { step: "success" }).catch(() => {});
      try {
        await captureIDB.clearSession(sessionId);
      } catch (e) {
        console.warn("IDB clearSession failed, retrying:", e);
        await captureIDB.clearSession(sessionId).catch(() => {});
      }
      setUploadProgress("done");
      setStep("success");
      setTimeout(() => onSuccessRedirect(), 1500);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress("error");
    }
  }, [sessionId, selectedProjectId, transcriptEntries, getAudioBlob, onSuccessRedirect]);

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
    <>
      <AlertDialog open={postDoneSavePromptOpen} onOpenChange={setPostDoneSavePromptOpen}>
        <AlertDialogContent className="z-[100] sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>Save photos to this device?</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 sm:gap-4">
            <AlertDialogCancel
              disabled={postDoneSaveBusy}
              className="mt-0"
              onClick={() => proceedToChooseProject()}
            >
              No
            </AlertDialogCancel>
            <Button
              className="bg-theme-action-primary hover:bg-theme-action-primary-hover"
              disabled={postDoneSaveBusy}
              onClick={() => void handlePostDoneSaveYes()}
            >
              {postDoneSaveBusy ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Preparing…
                </>
              ) : (
                "Yes"
              )}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
          onClick={() => void handleDone()}
          className="text-theme-primary hover:bg-slate-800 rounded-lg h-9 px-4"
        >
          Done
        </Button>
      </div>

      {isRecording && (
        <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/80 border-b border-slate-700">
          <div
            className={`w-2 h-2 rounded-full bg-red-500 ${isPaused ? "" : "animate-pulse"}`}
          />
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
            <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-4 px-4">
              {!isRecording ? (
                <Button
                  onClick={startCapture}
                  className="w-14 h-14 rounded-full bg-theme-action-primary hover:bg-theme-action-primary-hover"
                >
                  <Mic className="w-6 h-6" />
                </Button>
              ) : (
                <>
                  {!isPaused ? (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={pauseCapture}
                      className="w-12 h-12 rounded-full shrink-0 bg-slate-700 text-white hover:bg-slate-600 border-0"
                      aria-label="Pause recording"
                    >
                      <Pause className="w-5 h-5" />
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={resumeCapture}
                      className="w-12 h-12 rounded-full shrink-0 bg-slate-700 text-white hover:bg-slate-600 border-0"
                      aria-label="Resume recording"
                    >
                      <Play className="w-5 h-5" />
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={takePhoto}
                    className="w-16 h-16 rounded-full bg-white border-4 border-slate-300 shadow-xl flex items-center justify-center active:scale-95 shrink-0"
                  >
                    <div className="w-14 h-14 rounded-full bg-white" />
                  </button>
                  <div className="w-12 h-12 shrink-0" aria-hidden />
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
    </>
  );
}
