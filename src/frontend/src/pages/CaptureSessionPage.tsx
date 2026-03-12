"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "./ui_components/button";
import { Input } from "./ui_components/input";
import { Textarea } from "./ui_components/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui_components/tabs";
import { Camera, X, Mic, Square, FileText, Loader2, CheckCircle2, Search, Plus } from "lucide-react";
import { Project } from "@/frontend/types";

type Step = "capture" | "choose-project" | "uploading" | "success";

interface CapturedPhoto {
  id: number;
  blob: Blob;
  takenAtMs: number;
  previewUrl: string;
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
  const [notesText, setNotesText] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<"idle" | "uploading" | "done" | "error">("idle");

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const photoIdRef = useRef(0);

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
      const res = await fetch("/api/capture-sessions", { method: "POST" });
      if (!res.ok || cancelled) return;
      const data = await res.json();
      if (data.sessionId && data.folderName) {
        setSessionId(data.sessionId);
        setFolderName(data.folderName);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

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
    setAudioStartTimeMs(Date.now());
    setDurationSec(0);
    durationIntervalRef.current = setInterval(() => setDurationSec((s) => s + 1), 1000);
    setIsRecording(true);
  }, [supportedMimeType]);

  const stopRecording = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
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
        if (!blob) return;
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
  }, []);

  const handleDone = useCallback(() => {
    stopRecording();
    setStep("choose-project");
    setProjectsLoading(true);
    fetch("/api/project/list")
      .then((r) => r.json())
      .then((data) => (data.projects ? setProjects(data.projects) : null))
      .catch(() => {})
      .finally(() => setProjectsLoading(false));
  }, [stopRecording]);

  const handleCreateProject = useCallback(async () => {
    if (!createName.trim()) return;
    setCreateSubmitting(true);
    try {
      const res = await fetch("/api/project/create", {
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
      const finalizeRes = await fetch(`/api/capture-sessions/${sessionId}/finalize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId }),
      });
      if (!finalizeRes.ok) {
        const err = await finalizeRes.json().catch(() => ({}));
        throw new Error(err.error || "Finalize failed");
      }

      const form = new FormData();
      const audioBlob = getAudioBlob();
      if (audioBlob) form.append("audio", audioBlob, `session-audio-${sessionId}.webm`);
      photos.forEach((p, i) => {
        form.append("photos", p.blob, `photo-${i}.jpg`);
        form.append("taken_at_ms", String(p.takenAtMs));
      });
      if (notesText) form.set("notes_text", notesText);

      const uploadRes = await fetch(`/api/capture-sessions/${sessionId}/upload`, {
        method: "POST",
        body: form,
      });
      if (!uploadRes.ok) {
        const err = await uploadRes.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      setUploadProgress("done");
      setStep("success");
      setTimeout(() => onSuccessRedirect(projectId), 1500);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Upload failed");
      setUploadProgress("error");
    }
  }, [sessionId, selectedProjectId, photos, notesText, getAudioBlob, onSuccessRedirect]);

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
              {filteredProjects.map((p) => (
                <button
                  key={String(p.id)}
                  onClick={() => setSelectedProjectId(String(p.id))}
                  className={`w-full p-3 rounded-xl border-2 text-left transition-all ${
                    selectedProjectId === String(p.id) ? "border-theme-action-primary bg-theme-primary-5" : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <span className="font-medium text-slate-900">{p.name}</span>
                  <span className="block text-xs text-slate-500">{p.status}</span>
                </button>
              ))}
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
            <p className="text-red-400 mb-4">{uploadError}</p>
            <Button variant="outline" className="rounded-lg" onClick={() => setStep("choose-project")}>
              Back
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="w-12 h-12 animate-spin text-theme-primary mb-4" />
            <p className="text-white">Uploading...</p>
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

      <Tabs defaultValue="camera" className="flex-1 flex flex-col min-h-0">
        <TabsList className="w-full grid grid-cols-2 rounded-none border-b border-slate-700 bg-slate-900/95 shrink-0">
          <TabsTrigger value="camera" className="rounded-none border-b-2 border-transparent data-[state=active]:border-theme-primary data-[state=active]:bg-transparent text-white">
            <Camera className="w-4 h-4 mr-2" />
            Camera
          </TabsTrigger>
          <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-theme-primary data-[state=active]:bg-transparent text-white">
            <FileText className="w-4 h-4 mr-2" />
            Notes
          </TabsTrigger>
        </TabsList>
        <TabsContent value="camera" className="flex-1 flex flex-col min-h-0 m-0 p-0">
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
        </TabsContent>
        <TabsContent value="notes" className="flex-1 m-0 p-3 overflow-auto">
          <Textarea
            placeholder="Session notes (saved with upload)..."
            value={notesText}
            onChange={(e) => setNotesText(e.target.value)}
            className="min-h-[200px] rounded-lg resize-none"
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
