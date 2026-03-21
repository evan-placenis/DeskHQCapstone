/**
 * IndexedDB persistence layer for capture session photos and state.
 * Provides crash-recovery: photos are written to IDB immediately on capture
 * and upload progress is tracked per-photo so partial uploads can resume.
 */

const DB_NAME = "deskhq-capture";
const DB_VERSION = 1;
const PHOTOS_STORE = "photos";
const SESSIONS_STORE = "sessions";

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
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(PHOTOS_STORE)) {
        const store = db.createObjectStore(PHOTOS_STORE, {
          keyPath: ["sessionId", "photoId"],
        });
        store.createIndex("bySession", "sessionId", { unique: false });
      }
      if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        db.createObjectStore(SESSIONS_STORE, { keyPath: "sessionId" });
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

  async getPhotos(sessionId: string): Promise<IDBPhoto[]> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(PHOTOS_STORE, "readonly");
      const req = tx.objectStore(PHOTOS_STORE)
        .index("bySession")
        .getAll(sessionId);
      req.onsuccess = () => { db.close(); resolve(req.result as IDBPhoto[]); };
      req.onerror = () => { db.close(); reject(req.error); };
    });
  },

  async getRecoverableSession(): Promise<{
    session: IDBSession;
    photos: IDBPhoto[];
  } | null> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction([SESSIONS_STORE, PHOTOS_STORE], "readonly");
      const sessReq = tx.objectStore(SESSIONS_STORE).getAll();

      sessReq.onsuccess = () => {
        const sessions = sessReq.result as IDBSession[];
        const now = Date.now();

        const incomplete = sessions
          .filter(
            (s) =>
              s.step !== "success" &&
              now - s.createdAt < MAX_SESSION_AGE_MS
          )
          .sort((a, b) => b.createdAt - a.createdAt)[0];

        if (!incomplete) {
          db.close();
          resolve(null);
          return;
        }

        const photoReq = tx
          .objectStore(PHOTOS_STORE)
          .index("bySession")
          .getAll(incomplete.sessionId);

        photoReq.onsuccess = () => {
          db.close();
          const photos = photoReq.result as IDBPhoto[];
          if (photos.length === 0 && incomplete.step === "capture") {
            resolve(null);
          } else {
            resolve({ session: incomplete, photos });
          }
        };
        photoReq.onerror = () => { db.close(); reject(photoReq.error); };
      };
      sessReq.onerror = () => { db.close(); reject(sessReq.error); };
    });
  },

  async clearSession(sessionId: string): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(
        [SESSIONS_STORE, PHOTOS_STORE],
        "readwrite"
      );
      tx.objectStore(SESSIONS_STORE).delete(sessionId);

      const photoStore = tx.objectStore(PHOTOS_STORE);
      const cursorReq = photoStore.index("bySession").openCursor(sessionId);
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
};
