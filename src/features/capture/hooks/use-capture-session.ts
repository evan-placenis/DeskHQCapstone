import { useState, useRef, useCallback } from "react";

export function pickSupportedAudioMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm")) return "audio/webm";
  if (MediaRecorder.isTypeSupported("audio/mp4")) return "audio/mp4";
  return null;
}

export type UseCaptureSessionOptions = {
  /** Called once when the first non-empty audio chunk is available (e.g. persist recovery flag). */
  onFirstAudioChunk?: () => void;
};

export function useCaptureSession(
  stream: MediaStream | null,
  options?: UseCaptureSessionOptions
) {
  const { onFirstAudioChunk } = options ?? {};
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [durationMs, setDurationMs] = useState(0);

  const sessionStartMs = useRef<number | null>(null);
  const totalPausedMs = useRef(0);
  const currentPauseStartMs = useRef<number | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const outputMimeRef = useRef<string>("audio/webm");
  const firstChunkReportedRef = useRef(false);

  const getEncodedTimelineMs = useCallback(() => {
    if (!sessionStartMs.current) return 0;
    const now = Date.now();
    let activePauseDuration = 0;
    if (isPaused && currentPauseStartMs.current) {
      activePauseDuration = now - currentPauseStartMs.current;
    }
    return now - sessionStartMs.current - totalPausedMs.current - activePauseDuration;
  }, [isPaused]);

  const stopTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  const startTimer = useCallback(() => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setDurationMs(getEncodedTimelineMs());
    timerIntervalRef.current = setInterval(() => {
      setDurationMs(getEncodedTimelineMs());
    }, 1000);
  }, [getEncodedTimelineMs]);

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
      audioChunksRef.current.push(e.data);
      if (!firstChunkReportedRef.current) {
        firstChunkReportedRef.current = true;
        onFirstAudioChunk?.();
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start(1000);
  }, [stream, onFirstAudioChunk]);

  const startSession = useCallback(() => {
    if (!stream) return;
    const mime = pickSupportedAudioMimeType();
    if (!mime) return;

    sessionStartMs.current = Date.now();
    totalPausedMs.current = 0;
    currentPauseStartMs.current = null;
    audioChunksRef.current = [];
    firstChunkReportedRef.current = false;

    initializeRecorder();
    setIsRecording(true);
    setIsPaused(false);
    startTimer();
  }, [stream, initializeRecorder, startTimer]);

  const pauseSession = useCallback(() => {
    if (!isRecording || isPaused) return;

    const rec = mediaRecorderRef.current;
    if (rec && rec.state === "recording") {
      rec.stop();
    }
    mediaRecorderRef.current = null;

    currentPauseStartMs.current = Date.now();
    setIsPaused(true);
    stopTimer();

    if (sessionStartMs.current && currentPauseStartMs.current) {
      const frozenMs =
        currentPauseStartMs.current -
        sessionStartMs.current -
        totalPausedMs.current;
      setDurationMs(Math.max(0, frozenMs));
    }
  }, [isRecording, isPaused, stopTimer]);

  const resumeSession = useCallback(() => {
    if (!isRecording || !isPaused || !currentPauseStartMs.current) return;

    const pauseDuration = Date.now() - currentPauseStartMs.current;
    totalPausedMs.current += pauseDuration;
    currentPauseStartMs.current = null;

    initializeRecorder();
    setIsPaused(false);
    startTimer();
  }, [isRecording, isPaused, initializeRecorder, startTimer]);

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

    return new Blob(audioChunksRef.current, { type: mime });
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
  };
}
