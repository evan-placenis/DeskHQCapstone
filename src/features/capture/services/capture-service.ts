import type { CaptureSession } from "./capture-session-repository";
import { CaptureSessionRepository } from "./capture-session-repository";
import { ProjectService } from "@/features/projects/services/project-service";
import { StorageService } from "@/features/projects/services/storage-service";
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import { parseTranscriptTextFromDb } from "@/features/capture/lib/transcript-payload";

export class ServiceError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "ServiceError";
  }
}

export class CaptureService {
  private captureSessionRepo: CaptureSessionRepository;
  private projectService: ProjectService;
  private storageService: StorageService;

  constructor(
    captureSessionRepo: CaptureSessionRepository,
    projectService: ProjectService,
    storageService: StorageService
  ) {
    this.captureSessionRepo = captureSessionRepo;
    this.projectService = projectService;
    this.storageService = storageService;
  }

  // ── Capture Session CRUD ──

  async createSession(
    orgId: string,
    userId: string,
    client: SupabaseClient
  ): Promise<{ sessionId: string; folderName: string }> {
    const sessionId = uuidv4();
    const folderName = `capture-session-${sessionId}`;

    await this.captureSessionRepo.create({
      id: sessionId,
      organization_id: orgId,
      created_by: userId,
      status: "draft",
      folder_name: folderName,
    }, client);

    return { sessionId, folderName };
  }

  async finalizeSession(
    sessionId: string,
    params: {
      projectId?: string;
      createProject?: { name: string; clientName?: string; address?: string };
    },
    orgId: string,
    userId: string,
    client: SupabaseClient
  ): Promise<{ sessionId: string; projectId: string; folderName: string; organizationId: string }> {
    let projectId: string;

    if (params.createProject?.name) {
      const newProject = await this.projectService.createProject({
        name: params.createProject.name,
        clientName: params.createProject.clientName,
        address: params.createProject.address,
        orgId,
        userId,
      }, client);
      projectId = newProject.projectId;
    } else if (params.projectId) {
      projectId = params.projectId;
    } else {
      throw new ServiceError("Provide projectId or createProject: { name, clientName?, address? }", 400);
    }

    const project = await this.projectService.getById(projectId, client);
    if (!project || project.organizationId !== orgId) {
      throw new ServiceError("Project not found or access denied.", 403);
    }

    const session = await this.captureSessionRepo.getById(sessionId, client);
    if (!session) {
      throw new ServiceError("Capture session not found", 404);
    }

    await this.captureSessionRepo.update(sessionId, {
      project_id: projectId,
      status: "finalized",
    }, client);

    return { sessionId, projectId, folderName: session.folder_name, organizationId: orgId };
  }

  async uploadAssets(
    sessionId: string,
    data: {
      photos: File[];
      takenAtMs: number[];
      audioFile: File | null;
      /** Full recording length in seconds (from client timeline); used for playback UI. */
      audioDurationSeconds?: number | null;
    },
    userId: string,
    client: SupabaseClient
  ): Promise<{ images: unknown[]; audio: { public_url: string; storage_path: string } | null }> {
    const session = await this.captureSessionRepo.getById(sessionId, client);
    if (!session) {
      throw new ServiceError("Capture session not found", 404);
    }

    const projectId = session.project_id;
    if (!projectId) {
      throw new ServiceError(
        "Capture session not finalized. Call finalize with projectId or createProject first.",
        400
      );
    }

    const organizationId = session.organization_id;
    const folderName = session.folder_name;
    const uploadedImageRows: unknown[] = [];

    for (let i = 0; i < data.photos.length; i++) {
      const file = data.photos[i];
      const takenAt = data.takenAtMs[i] ?? 0;

      const uploadedImage = await this.storageService.uploadProjectImage(
        projectId,
        organizationId,
        userId,
        file,
        file.name,
        folderName,
        "",
        client
      );

      await this.captureSessionRepo.insertSessionImage({
        capture_session_id: sessionId,
        project_image_id: uploadedImage.id,
        taken_at_ms: takenAt,
      }, client);

      uploadedImageRows.push(uploadedImage);
    }

    let audioResult: { public_url: string; storage_path: string } | null = null;

    const baseSessionPatch: Partial<CaptureSession> = {
      status: "uploaded",
    };
    if (
      data.audioDurationSeconds != null &&
      Number.isFinite(data.audioDurationSeconds) &&
      data.audioDurationSeconds > 0
    ) {
      baseSessionPatch.audio_duration_seconds = data.audioDurationSeconds;
    }

    if (data.audioFile && data.audioFile.size > 0) {
      // Legacy: audio sent in FormData (small files); server uploads via TUS
      const fileName = `session-audio-${sessionId}.webm`;
      const result = await this.storageService.uploadProjectAudio(
        projectId,
        organizationId,
        userId,
        data.audioFile,
        fileName,
        folderName,
        client
      );

      await this.captureSessionRepo.update(sessionId, {
        ...baseSessionPatch,
        audio_storage_path: result.storage_path,
        audio_public_url: result.public_url,
      }, client);

      audioResult = { public_url: result.public_url, storage_path: result.storage_path };
    } else {
      await this.captureSessionRepo.update(sessionId, baseSessionPatch, client);
    }

    return { images: uploadedImageRows, audio: audioResult };
  }

  async getAudioTimeline(
    projectId: string,
    folderName: string,
    client: SupabaseClient
  ): Promise<{
    sessionId: string | null;
    audioUrl: string | null;
    audioStoragePath: string | null;
    audioDurationSeconds: number | null;
    segments: Array<{ text: string; timestampMs: number; endMs?: number }>;
    summaryNote: string | null;
    referencedImages: string[];
    photos: Array<{
      id: string;
      url: string;
      storagePath: string;
      name: string;
      takenAtMs: number;
      audioDescription: string | null;
    }>;
  }> {
    const session = await this.captureSessionRepo.getSessionByFolderAndProject(folderName, projectId, client);

    const sessionId = session?.id ?? null;
    const audioUrl = session?.audio_public_url ?? null;
    const audioStoragePath = session?.audio_storage_path ?? null;
    const audioDurationSeconds = session?.audio_duration_seconds ?? null;

    const parsedTranscript = parseTranscriptTextFromDb(session?.transcript_text);
    const { segments, summaryNote, referencedImages } = parsedTranscript;

    const folderImages = await this.storageService.getProjectImagesByFolder(projectId, folderName, client);

    let takenAtMap: Record<string, number> = {};
    if (sessionId && folderImages.length > 0) {
      const imageIds = folderImages.map((img: any) => img.id);
      const sessionImages = await this.captureSessionRepo.getSessionImagesBySessionId(sessionId, imageIds, client);
      for (const si of sessionImages) {
        takenAtMap[si.project_image_id] = si.taken_at_ms;
      }
    }

    const photos = folderImages.map((img: any, idx: number) => ({
      id: img.id,
      url: img.public_url,
      storagePath: img.storage_path,
      name: img.file_name,
      takenAtMs: takenAtMap[img.id] ?? idx * 1000,
      audioDescription:
        typeof img.audio_description === "string" && img.audio_description.trim().length > 0
          ? img.audio_description.trim()
          : null,
    }));

    return {
      sessionId,
      audioUrl,
      audioStoragePath,
      audioDurationSeconds,
      segments,
      summaryNote,
      referencedImages,
      photos,
    };
  }
}
