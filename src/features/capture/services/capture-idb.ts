/**
 * IndexedDB persistence layer for capture session photos and state.
 * Provides crash-recovery: photos are written to IDB immediately on capture
 * and upload progress is tracked per-photo so partial uploads can resume.
 */

const DB_NAME = "deskhq-capture";
/** Must never be lower than the version already on disk for this origin (opens with VersionError). */
const DB_VERSION = 3;
const PHOTOS_STORE = "photos";
const SESSIONS_STORE = "sessions";
const AUDIO_CHUNKS_STORE = "audioChunks";

const MAX_SESSION_AGE_MS = 24 * 60 * 60 * 1000;

export interface IDBPhoto {
  sessionId: string;
  photoId: number;
  blob: Blob;
  takenAtMs: number;
  uploaded: boolean;
}

export interface IDBSession {
  sessionId: string;
  folderName: string;
  step: string;
  projectId: string | null;
  finalized: boolean;
  audioUploaded: boolean;
  metadataSent: boolean;
  transcriptEntries: { text: string; timestampMs: number }[];
  createdAt: number;
  /** True once mic recording produced at least one audio chunk (persisted for recovery). */
  localAudioCaptured?: boolean;
  /** Last known encoded timeline position (ms), updated as chunks are saved. */
  audioEncodedDurationMs?: number;
  /** MIME type of recorded segments (for merging recovered chunks). */
  audioMimeType?: string;
}

export interface IDBAudioChunk {
  sessionId: string;
  chunkIndex: number;
  blob: Blob;
}

/** Session is worth recovering only if it has photos, audio, speech transcript, or progressed past empty capture. */
function sessionHasRecoverableContent(
  session: IDBSession,
  photos: IDBPhoto[]
): boolean {
  if (photos.length > 0) return true;
  if (session.step !== "capture") return true;
  if (session.projectId) return true;
  if (session.transcriptEntries?.length) return true;
  if (session.localAudioCaptured) return true;
  return false;
}

function isImageBlob(value: unknown): value is Blob {
  if (!(value instanceof Blob) || value.size === 0) return false;
  if (typeof value.type === "string" && value.type.startsWith("image/")) return true;
  // After IDB round-trip some browsers lose the MIME type — accept non-empty blobs
  // that were originally stored as images (the store only accepts validated blobs).
  if (!value.type || value.type === "") return true;
  return false;
}

function toValidPhotoRecord(value: unknown): IDBPhoto | null {
  if (!value || typeof value !== "object") return null;
  const rec = value as Partial<IDBPhoto>;
  if (
    typeof rec.sessionId !== "string" ||
    typeof rec.photoId !== "number" ||
    typeof rec.takenAtMs !== "number" ||
    typeof rec.uploaded !== "boolean"
  ) {
    return null;
  }
  if (!(rec.blob instanceof Blob) || rec.blob.size === 0) return null;
  return rec as IDBPhoto;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        const store = db.createObjectStore(PHOTOS_STORE, {
          keyPath: ["sessionId", "photoId"],
        });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "sessionId" });
      }
      if (!db.objectStoreNames.contains(AUDIO_CHUNKS_STORE)) {
        const store = db.createObjectStore(AUDIO_CHUNKS_STORE, {
          keyPath: ["sessionId", "chunkIndex"],
        });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const captureIDB = {
  async saveSession(session: IDBSession): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      tx.objectStore(SESSIONS_STORE).put(session);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async getSession(sessionId: string): Promise<IDBSession | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const req = tx.objectStore(SESSIONS_STORE).get(sessionId);
      req.onsuccess = () => { db.close(); resolve(req.result ?? null); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async updateSession(
    sessionId: string,
    updates: Partial<Omit<IDBSession, "sessionId">>
  ): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readwrite");
      const store = tx.objectStore(SESSIONS_STORE);
      const getReq = store.get(sessionId);
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, ...updates });
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async savePhoto(
    sessionId: string,
    photoId: number,
    blob: Blob,
    takenAtMs: number
  ): Promise<void> {
    if (!isImageBlob(blob)) {
      throw new Error("Invalid photo blob: expected a non-empty image blob.");
    }

    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE, "readwrite");
      tx.objectStore(PHOTOS_STORE).put({
        sessionId,
        photoId,
        blob,
        takenAtMs,
        uploaded: false,
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async removePhoto(sessionId: string, photoId: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE, "readwrite");
      tx.objectStore(PHOTOS_STORE).delete([sessionId, photoId]);
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async markPhotoUploaded(sessionId: string, photoId: number): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE, "readwrite");
      const store = tx.objectStore(PHOTOS_STORE);
      const getReq = store.get([sessionId, photoId]);
      getReq.onsuccess = () => {
        if (getReq.result) {
          store.put({ ...getReq.result, uploaded: true });
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async saveAudioChunk(
    sessionId: string,
    chunkIndex: number,
    blob: Blob
  ): Promise<void> {
    if (!(blob instanceof Blob) || blob.size === 0) return;
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_CHUNKS_STORE, "readwrite");
      tx.objectStore(AUDIO_CHUNKS_STORE).put({
        sessionId,
        chunkIndex,
        blob,
      });
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  /**
   * Loads ordered audio blobs and the next chunk index for IDB (max stored index + 1).
   * Use `nextChunkIndex` when resuming recording so new chunks never overwrite recovered keys.
   */
  async getAudioChunksWithMeta(sessionId: string): Promise<{
    blobs: Blob[];
    nextChunkIndex: number;
  }> {
    const db = await openDB();
    const rows = await new Promise<IDBAudioChunk[]>((resolve, reject) => {
      const tx = db.transaction(AUDIO_CHUNKS_STORE, "readonly");
      const req = tx.objectStore(AUDIO_CHUNKS_STORE)
        .index("bySession")
        .getAll(sessionId);
      req.onsuccess = () => {
        db.close();
        const list = (req.result as IDBAudioChunk[]) || [];
        resolve(list);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
    rows.sort((a, b) => a.chunkIndex - b.chunkIndex);
    const maxIdx =
      rows.length === 0 ? -1 : Math.max(...rows.map((r) => r.chunkIndex));
    const blobs = rows
      .map((r) => r.blob)
      .filter((b) => b instanceof Blob && b.size > 0);
    return {
      blobs,
      nextChunkIndex: maxIdx + 1,
    };
  },

  async getAudioChunks(sessionId: string): Promise<Blob[]> {
    const { blobs } = await captureIDB.getAudioChunksWithMeta(sessionId);
    return blobs;
  },

  async clearAudioChunks(sessionId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(AUDIO_CHUNKS_STORE, "readwrite");
      const store = tx.objectStore(AUDIO_CHUNKS_STORE);
      const cursorReq = store.index("bySession").openCursor(sessionId);
      cursorReq.onsuccess = () => {
        const cursor = cursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async getPhotos(sessionId: string): Promise<IDBPhoto[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE, "readonly");
      const req = tx.objectStore(PHOTOS_STORE)
        .index("bySession")
        .getAll(sessionId);
      req.onsuccess = () => {
        db.close();
        const rows = Array.isArray(req.result) ? req.result : [];
        resolve(rows.map(toValidPhotoRecord).filter((p): p is IDBPhoto => p !== null));
      };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  /**
   * Returns the best incomplete session that has recoverable content (photos, audio, transcript,
   * or progressed past capture). Purges empty capture-only sessions (no photos, no audio signal).
   */
  async getRecoverableSession(): Promise<{
    session: IDBSession;
    photos: IDBPhoto[];
  } | null> {
    const db = await openDB();
    const sessions = await new Promise<IDBSession[]>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const r = tx.objectStore(SESSIONS_STORE).getAll();
      r.onsuccess = () => {
        db.close();
        resolve((r.result as IDBSession[]) || []);
      };
      r.onerror = () => {
        db.close();
        reject(r.error);
      };
    });

    const now = Date.now();
    const candidates = sessions
      .filter(
        (s) =>
          s.step !== "success" &&
          now - s.createdAt < MAX_SESSION_AGE_MS
      )
      .sort((a, b) => {
        const aWeight = a.step !== "capture" || a.projectId ? 1 : 0;
        const bWeight = b.step !== "capture" || b.projectId ? 1 : 0;
        if (aWeight !== bWeight) return bWeight - aWeight;
        return b.createdAt - a.createdAt;
      });

    for (const candidate of candidates) {
      const photos = await captureIDB.getPhotos(candidate.sessionId);
      const audioChunks = await captureIDB.getAudioChunks(candidate.sessionId);
      const hasPersistedAudio = audioChunks.length > 0;
      if (
        sessionHasRecoverableContent(candidate, photos) ||
        hasPersistedAudio
      ) {
        return { session: candidate, photos };
      }
      await captureIDB.clearSession(candidate.sessionId);
    }
    return null;
  },

  /** Deletes every session except `keepSessionId` and their photos. Enforces one active session in IDB. */
  async deleteAllSessionsExcept(keepSessionId: string): Promise<void> {
    const db = await openDB();
    const sessions = await new Promise<IDBSession[]>((resolve, reject) => {
      const tx = db.transaction(SESSIONS_STORE, "readonly");
      const r = tx.objectStore(SESSIONS_STORE).getAll();
      r.onsuccess = () => {
        db.close();
        resolve((r.result as IDBSession[]) || []);
      };
      r.onerror = () => {
        db.close();
        reject(r.error);
      };
    });
    for (const s of sessions) {
      if (s.sessionId === keepSessionId) continue;
      await captureIDB.clearSession(s.sessionId);
    }
  },

  /** Wipes all capture sessions and photos (before creating a brand-new session). */
  async clearAllCaptureData(): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, PHOTOS_STORE, AUDIO_CHUNKS_STORE], "readwrite");
      tx.objectStore(SESSIONS_STORE).clear();
      tx.objectStore(PHOTOS_STORE).clear();
      if (db.objectStoreNames.contains(AUDIO_CHUNKS_STORE)) {
        tx.objectStore(AUDIO_CHUNKS_STORE).clear();
      }
      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

  async clearSession(sessionId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const stores: string[] = [SESSIONS_STORE, PHOTOS_STORE];
      if (db.objectStoreNames.contains(AUDIO_CHUNKS_STORE)) {
        stores.push(AUDIO_CHUNKS_STORE);
      }
      const tx = db.transaction(stores, "readwrite");
      tx.objectStore(SESSIONS_STORE).delete(sessionId);

      const photoStore = tx.objectStore(PHOTOS_STORE);
      const photoCursorReq = photoStore.index("bySession").openCursor(sessionId);
      photoCursorReq.onsuccess = () => {
        const cursor = photoCursorReq.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };

      if (db.objectStoreNames.contains(AUDIO_CHUNKS_STORE)) {
        const audioStore = tx.objectStore(AUDIO_CHUNKS_STORE);
        const audioCursorReq = audioStore.index("bySession").openCursor(sessionId);
        audioCursorReq.onsuccess = () => {
          const cursor = audioCursorReq.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
      }

      tx.oncomplete = () => { db.close(); resolve(); };
      tx.onerror = () => { db.close(); reject(tx.error); };
    });
  },

};
