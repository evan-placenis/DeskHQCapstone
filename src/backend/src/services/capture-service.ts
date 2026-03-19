import { CaptureOrchestrator } from '@/features/ai/orchestrators/capture-orchestrator';
import { CaptureSessionRepository } from "../domain/interfaces/capture-session-repository";
import { ProjectService } from "./project-service";
import { StorageService } from "./storage-service";
import { SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

export interface AnalyzeAudioParams {
  audioUrls: string[];
  prompt?: string;
  provider?: 'grok' | 'gemini-pro' | 'claude' | 'gemini-cheap';
  projectId?: string;
  userId?: string;
  reportId?: string;
  client: SupabaseClient;
  onFinish?: (event: { text: string; finishReason: string }) => void | Promise<void>;
}

export class ServiceError extends Error {
  constructor(message: string, public statusCode: number) {
    super(message);
    this.name = "ServiceError";
  }
}

export class CaptureService {

  private orchestrator: CaptureOrchestrator;
  private captureSessionRepo: CaptureSessionRepository;
  private projectService: ProjectService;
  private storageService: StorageService;

  constructor(
    orchestrator: CaptureOrchestrator,
    captureSessionRepo: CaptureSessionRepository,
    projectService: ProjectService,
    storageService: StorageService
  ) {
    this.orchestrator = orchestrator;
    this.captureSessionRepo = captureSessionRepo;
    this.projectService = projectService;
    this.storageService = storageService;
  }

  // ── Audio Analysis (AI) ──

  async analyzeAudioStream(params: AnalyzeAudioParams) {
    const {
      audioUrls,
      prompt = 'Transcribe and summarize this audio recording.',
      provider = 'gemini-cheap',
      projectId,
      userId,
      reportId,
      client,
      onFinish,
    } = params;

    const userMessage = audioUrls.length > 0
      ? `${prompt}\n\nAudio files to analyze:\n${audioUrls.map((url, i) => `${i + 1}. ${url}`).join('\n')}`
      : prompt;

    const messages = [{ role: 'user' as const, content: userMessage }];

    const systemMessage = `You are an assistant for engineering site inspections and report writing.
When the user provides audio file URLs, use your audio analysis tools to process them.
Provide a clear transcription and/or summary of the key observations, safety notes, or findings.
If the user asks for a specific format (e.g. bullet points, report section), structure your response accordingly.`;

    return this.orchestrator.generateStream({
      messages,
      provider,
      projectId,
      userId,
      reportId,
      client,
      systemMessage,
      onFinish,
    });
  }

  async analyzeAudio(params: Omit<AnalyzeAudioParams, 'onFinish'>): Promise<string> {
    const streamResult = await this.analyzeAudioStream(params);

    let fullText = '';
    for await (const chunk of streamResult.textStream) {
      fullText += chunk;
    }

    return fullText;
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
      notesText: string | null;
      transcriptSegments: string | null;
      /** When true, audio was uploaded client-side via TUS; path is constructed from session. */
      audioClientUploaded?: boolean;
    },
    userId: string,
    client: SupabaseClient
  ): Promise<{ images: unknown[]; audio: { public_url: string; storage_path: string } | null }> {
    const session = await this.captureSessionRepo.getById(sessionId, client);
    if (!session) {
      throw new Error("Capture session not found");
    }

    const projectId = session.project_id;
    if (!projectId) {
      throw new Error("Capture session not finalized. Call finalize with projectId or createProject first.");
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

    if (data.audioClientUploaded) {
      // Audio was uploaded directly from client via TUS; construct path and update DB
      const safeFolder = folderName.replace(/\//g, '-');
      const fileName = `session-audio-${sessionId}.webm`;
      const storagePath = `${organizationId}/${projectId}/${safeFolder}/${fileName}`;
      const bucketName = 'project-audio';
      const { data: { publicUrl } } = client.storage.from(bucketName).getPublicUrl(storagePath);

      await this.captureSessionRepo.update(sessionId, {
        audio_storage_path: storagePath,
        audio_public_url: publicUrl,
        notes_text: data.notesText,
        transcript_text: data.transcriptSegments,
        status: "uploaded",
      }, client);

      audioResult = { public_url: publicUrl, storage_path: storagePath };
    } else if (data.audioFile && data.audioFile.size > 0) {
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
        audio_storage_path: result.storage_path,
        audio_public_url: result.public_url,
        notes_text: data.notesText,
        transcript_text: data.transcriptSegments,
        status: "uploaded",
      }, client);

      audioResult = { public_url: result.public_url, storage_path: result.storage_path };
    } else {
      await this.captureSessionRepo.update(sessionId, {
        notes_text: data.notesText,
        transcript_text: data.transcriptSegments,
        status: "uploaded",
      }, client);
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
    segments: Array<{ text: string; timestampMs: number }>;
    photos: Array<{ id: string; url: string; storagePath: string; name: string; takenAtMs: number }>;
  }> {
    const session = await this.captureSessionRepo.getSessionByFolderAndProject(folderName, projectId, client);

    const sessionId = session?.id ?? null;
    const audioUrl = session?.audio_public_url ?? null;
    const audioStoragePath = session?.audio_storage_path ?? null;
    const audioDurationSeconds = session?.audio_duration_seconds ?? null;

    let segments: Array<{ text: string; timestampMs: number }> = [];
    if (session?.transcript_text) {
      try {
        segments = JSON.parse(session.transcript_text);
      } catch {
        segments = [];
      }
    }

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
    }));

    return { sessionId, audioUrl, audioStoragePath, audioDurationSeconds, segments, photos };
  }
}
