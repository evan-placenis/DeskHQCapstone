/**
 * MediaRecorder pause implemented as stop + new recorder yields multiple standalone
 * container files. `new Blob([...])` is not a valid single file for Safari / <audio>.
 * Timeslice chunks from ONE recorder are often not independently decodable — in that
 * case we must keep the raw concatenated Blob.
 *
 * If every segment decodes on its own, we merge PCM and re-encode once so playback works
 * (Safari PWA, etc.) without changing how capture / pause / recovery record.
 */

function pickExporterMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";
  for (const m of [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/aac",
  ]) {
    if (MediaRecorder.isTypeSupported(m)) return m;
  }
  return "";
}

function getAudioContextCtor(): (typeof AudioContext) | null {
  if (typeof window === "undefined") return null;
  return (
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext ||
    null
  );
}

function decodeAudioData(ctx: AudioContext, data: ArrayBuffer): Promise<AudioBuffer> {
  return new Promise((resolve, reject) => {
    const copy = data.slice(0);
    ctx.decodeAudioData(copy, resolve, reject);
  });
}

function concatAudioBuffers(buffers: AudioBuffer[]): AudioBuffer {
  const sr = buffers[0].sampleRate;
  const ch = buffers[0].numberOfChannels;
  if (buffers.some((b) => b.sampleRate !== sr || b.numberOfChannels !== ch)) {
    throw new Error("Audio buffer format mismatch");
  }
  const total = buffers.reduce((n, b) => n + b.length, 0);
  const out = new AudioBuffer({ length: total, numberOfChannels: ch, sampleRate: sr });
  let offset = 0;
  for (const buf of buffers) {
    for (let c = 0; c < ch; c++) {
      out.getChannelData(c).set(buf.getChannelData(c), offset);
    }
    offset += buf.length;
  }
  return out;
}

async function encodeBufferToBlob(buffer: AudioBuffer): Promise<Blob | null> {
  const exportMime = pickExporterMimeType();
  if (!exportMime) return null;

  const AC = getAudioContextCtor();
  if (!AC) return null;

  const ac = new AC({ sampleRate: buffer.sampleRate });
  try {
    await ac.resume().catch(() => {});

    const dest = ac.createMediaStreamDestination();
    const src = ac.createBufferSource();
    src.buffer = buffer;
    src.connect(dest);

    const chunks: Blob[] = [];
    const rec = new MediaRecorder(dest.stream, { mimeType: exportMime });
    const done = new Promise<void>((resolve, reject) => {
      rec.addEventListener("stop", () => resolve(), { once: true });
      rec.addEventListener("error", () => reject(new Error("MediaRecorder error")), {
        once: true,
      });
    });

    rec.ondataavailable = (e) => {
      if (e.data?.size) chunks.push(e.data);
    };

    rec.start();
    src.start(0);
    await new Promise<void>((resolve) => {
      src.onended = () => resolve();
    });
    rec.stop();
    await done;

    if (chunks.length === 0) return null;
    return new Blob(chunks, { type: exportMime });
  } finally {
    await ac.close();
  }
}

/**
 * When each blob is a complete decodable file (typical after hard stop/start pauses),
 * returns one container suitable for `<audio>`. Otherwise returns the same bytes as
 * `new Blob(segments, { type })` (single-recorder timeslice case).
 */
export async function flattenMultiPartAudioBlob(
  segments: Blob[],
  mimeHint: string
): Promise<Blob> {
  if (segments.length === 0) return new Blob([], { type: mimeHint });
  if (segments.length === 1) return segments[0];

  const AC = getAudioContextCtor();
  if (!AC) return new Blob(segments, { type: mimeHint });

  const decodeCtx = new AC();
  const buffers: AudioBuffer[] = [];
  try {
    for (const seg of segments) {
      if (seg.size === 0) continue;
      try {
        const ab = await seg.arrayBuffer();
        buffers.push(await decodeAudioData(decodeCtx, ab));
      } catch {
        return new Blob(segments, { type: mimeHint });
      }
    }
  } finally {
    await decodeCtx.close();
  }

  if (buffers.length === 0) return new Blob(segments, { type: mimeHint });
  if (buffers.length === 1) {
    const encoded = await encodeBufferToBlob(buffers[0]);
    return encoded && encoded.size > 0 ? encoded : new Blob(segments, { type: mimeHint });
  }

  try {
    const merged = concatAudioBuffers(buffers);
    const encoded = await encodeBufferToBlob(merged);
    return encoded && encoded.size > 0 ? encoded : new Blob(segments, { type: mimeHint });
  } catch {
    return new Blob(segments, { type: mimeHint });
  }
}
