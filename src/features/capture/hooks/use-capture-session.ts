import { useState, useRef, useCallback, useEffect } from "react";
import { flattenMultiPartAudioBlob } from "../utils/flatten-multi-part-audio-blob";

export function pickSupportedAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}

export type UseCaptureSessionOptions = {
  onAudioChunkPersist?: (payload: {
    chunkIndex: number;
    blob: Blob;
    encodedDurationMs: number;
    mimeType: string;
  }) => void;
  /** Called when starting a brand-new recording (not continuing after recovery). */
  onFreshSessionStart?: () => void;
};

export function useCaptureSession(
  stream: MediaStream | null,
  options?: UseCaptureSessionOptions
) {
  const { onAudioChunkPersist, onFreshSessionStart } = options ?? {};
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const sessionStartMs = useRef<number | null>(null);
  const totalPausedMs = useRef(0);
  const currentPauseStartMs = useRef<number | null>(null);
  const baseTimelineMsRef = useRef(0);
  const chunkIndexRef = useRef(0);
  const isPausedRef = useRef(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outputMimeRef = useRef<string>("audio/webm");
  const firstChunkReportedRef = useRef(false);

  useEffect(() => {
    isPausedRef.current = isPaused;
  }, [isPaused]);

  const computeTimelineMs = useCallback(() => {
    if (!sessionStartMs.current) {
      return baseTimelineMsRef.current;
    }
    const now = Date.now();
    let activePauseDuration = 0;
    if (isPausedRef.current && currentPauseStartMs.current) {
      activePauseDuration = now - currentPauseStartMs.current;
    }
    return (
      baseTimelineMsRef.current +
      (now - sessionStartMs.current - totalPausedMs.current - activePauseDuration)
    );
  }, []);

  const getEncodedTimelineMs = useCallback(() => {
    return computeTimelineMs();
  }, [computeTimelineMs]);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setDurationMs(computeTimelineMs());
    timerIntervalRef.current = setInterval(() => {
      setDurationMs(computeTimelineMs());
    }, 1000);
  }, [computeTimelineMs]);

  const initializeRecorder = useCallback(() => {
    if (!stream) return;
    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) return;

    const mime = pickSupportedAudioMimeType();
    if (!mime) return;

    const audioStream = new MediaStream([audioTrack]);
    const recorder = new MediaRecorder(audioStream, { mimeType: mime });
    outputMimeRef.current = recorder.mimeType || mime;

    recorder.ondataavailable = (e) => {
      if (e.data.size === 0) return;
      const chunkIndex = chunkIndexRef.current;
      chunkIndexRef.current = chunkIndex + 1;
      audioChunksRef.current.push(e.data);
      const encodedMs = computeTimelineMs();
      if (!firstChunkReportedRef.current) {
        firstChunkReportedRef.current = true;
      }
      onAudioChunkPersist?.({
        chunkIndex,
        blob: e.data,
        encodedDurationMs: encodedMs,
        mimeType: outputMimeRef.current,
      });
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
  }, [stream, computeTimelineMs, onAudioChunkPersist]);

  const startSession = useCallback(
    (opts?: { continue?: boolean }) => {
      const cont = opts?.continue === true;
      if (!stream) return;
      const mime = pickSupportedAudioMimeType();
      if (!mime) return;

      if (!cont) {
        onFreshSessionStart?.();
        sessionStartMs.current = null;
        totalPausedMs.current = 0;
        currentPauseStartMs.current = null;
        baseTimelineMsRef.current = 0;
        audioChunksRef.current = [];
        chunkIndexRef.current = 0;
        firstChunkReportedRef.current = false;
      } else {
        totalPausedMs.current = 0;
        currentPauseStartMs.current = null;
        /* chunkIndexRef preserved (hydration / prior segment); do not reset to array length — that can collide with IDB keys after recovery. */
      }

      sessionStartMs.current = Date.now();
      initializeRecorder();
      setIsRecording(true);
      setIsPaused(false);
      startTimer();
    },
    [stream, initializeRecorder, startTimer, onFreshSessionStart]
  );

  const pauseSession = useCallback(() => {
    if (!isRecording || isPaused) return;

    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      /* Prefer pause/resume so the file stays one WebM. Concatenating separate
       * stop/start segments (each with its own EBML header) breaks <audio> playback
       * in common browsers while the full bytes still transcribe server-side. */
      if (typeof rec.pause === "function") {
        try {
          rec.pause();
        } catch {
          rec.stop();
          mediaRecorderRef.current = null;
        }
      } else {
        rec.stop();
        mediaRecorderRef.current = null;
      }
    }

    currentPauseStartMs.current = Date.now();
    setIsPaused(true);
    stopTimer();

    if (sessionStartMs.current && currentPauseStartMs.current) {
      const frozenMs =
        currentPauseStartMs.current -
        sessionStartMs.current -
        totalPausedMs.current;
      setDurationMs(Math.max(0, baseTimelineMsRef.current + frozenMs));
    }
  }, [isRecording, isPaused, stopTimer]);

  const resumeSession = useCallback(() => {
    if (!isRecording || !isPaused || !currentPauseStartMs.current) return;

    const pauseDuration = Date.now() - currentPauseStartMs.current;
    totalPausedMs.current += pauseDuration;
    currentPauseStartMs.current = null;

    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "paused" && typeof rec.resume === "function") {
      try {
        rec.resume();
      } catch {
        initializeRecorder();
      }
    } else {
      initializeRecorder();
    }

    setIsPaused(false);
    startTimer();
  }, [isRecording, isPaused, initializeRecorder, startTimer]);

  const hydrateFromRecovery = useCallback(
    (
      chunks: Blob[],
      mimeType: string,
      encodedDurationMs: number,
      nextChunkIndex: number
    ) => {
      stopTimer();
      mediaRecorderRef.current = null;
      sessionStartMs.current = null;
      totalPausedMs.current = 0;
      currentPauseStartMs.current = null;
      isPausedRef.current = false;
      setIsPaused(false);
      setIsRecording(false);

      audioChunksRef.current = [...chunks];
      chunkIndexRef.current = Math.max(0, nextChunkIndex);
      baseTimelineMsRef.current = Math.max(0, encodedDurationMs);
      outputMimeRef.current = mimeType || pickSupportedAudioMimeType() || "audio/webm";
      firstChunkReportedRef.current = chunks.length > 0;
      setDurationMs(encodedDurationMs);
    },
    [stopTimer]
  );

  const getChunkCount = useCallback(() => audioChunksRef.current.length, []);

  const getRawAudioSegmentsAndMime = useCallback((): { segments: Blob[]; mime: string } => {
    return {
      segments: [...audioChunksRef.current],
      mime: outputMimeRef.current || "audio/webm",
    };
  }, []);

  const getMergedAudioBlob = useCallback((): Blob | null => {
    if (audioChunksRef.current.length === 0) return null;
    const mime = outputMimeRef.current || "audio/webm";
    return new Blob(audioChunksRef.current, { type: mime });
  }, []);

  const endSession = useCallback(async (): Promise<Blob> => {
    stopTimer();

    const rec = mediaRecorderRef.current;
    const mime = outputMimeRef.current || "audio/webm";

    if (rec && rec.state !== "inactive") {
      await new Promise<void>((resolve) => {
        rec.addEventListener("stop", () => resolve(), { once: true });
        rec.stop();
      });
    }
    mediaRecorderRef.current = null;

    if (currentPauseStartMs.current) {
      const pauseDuration = Date.now() - currentPauseStartMs.current;
      totalPausedMs.current += pauseDuration;
      currentPauseStartMs.current = null;
    }

    setIsRecording(false);
    setIsPaused(false);
    sessionStartMs.current = null;

    const segments = [...audioChunksRef.current];
    audioChunksRef.current = [];
    chunkIndexRef.current = 0;
    baseTimelineMsRef.current = 0;
    setDurationMs(0);

    let blob: Blob;
    if (segments.length > 1) {
      blob = await flattenMultiPartAudioBlob(segments, mime);
    } else if (segments.length === 1) {
      blob = segments[0];
    } else {
      blob = new Blob([], { type: mime });
    }

    return blob;
  }, [stopTimer]);

  return {
    isRecording,
    isPaused,
    durationSec: Math.floor(durationMs / 1000),
    startSession,
    pauseSession,
    resumeSession,
    endSession,
    getEncodedTimelineMs,
    hydrateFromRecovery,
    getMergedAudioBlob,
    getChunkCount,
    getRawAudioSegmentsAndMime,
  };
}
