import { SupabaseChatRepository } from "@/features/chat/services/supabase-chat-repository";
import { SupabaseReportRepository } from "@/features/reports/services/supabase-report-repository";
import { SupabaseProjectRepository } from "@/features/projects/services/supabase-project-repository";
import { SupabaseKnowledgeRepository } from "@/features/knowledge/services/supabase-knowledge-repository";
import { SupabaseStatsRepository } from "@/features/dashboard/services/supabase-stats-repository";

import { PineconeVectorStore } from "@/features/knowledge/services/pinecone-vector-store";
import { DocumentStrategyFactory } from "@/features/knowledge/services/document-strategies/factory/document-factory";
import { ReportService } from "@/features/reports/services/report-service";
import { ChatService } from "@/features/chat/services/chat-service";
import { EditService } from "@/features/reports/services/edit-service";
import { ChatOrchestrator } from "@/features/ai/orchestrators/chat-orchestrator";
import { EditOrchestrator } from "@/features/ai/orchestrators/edit-orchestrator";
import { ReportOrchestrator } from "@/features/ai/orchestrators/report-orchestrator";
import { CaptureOrchestrator } from "@/features/ai/orchestrators/capture-orchestrator";
import { CaptureService } from "@/features/capture/services/capture-service";
import { ProjectService } from "@/features/projects/services/project-service";
import { SupabaseCaptureSessionRepository } from "@/features/capture/services/supabase-capture-session-repository";
import { KnowledgeService } from "@/features/knowledge/services/knowledge-servivce";
import { UserService } from "@/features/auth/services/user-service";
import { StorageService } from "@/features/projects/services/storage-service";
import { PhotoService } from "@/features/projects/services/photo-service";
import { StatsService } from "@/features/dashboard/services/stats-service";
import Exa from "exa-js";

import { SpecAgent } from "@/features/ai/services/llm/vision-agent/spec-agent";
import { SitePhotoAgent } from "@/features/ai/services/llm/vision-agent/site-photo-agent";

import { TriggerJobQueue } from "@/features/reports/services/trigger/trigger-job-queue";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 🛑 ADD THIS DEBUG CHECK
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error("🚨 CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing from process.env!");
}

export class Container {
  // --- Private Cache (Singletons) ---
  private static _adminClient: SupabaseClient;
  private static _supabase: SupabaseClient;
  private static _projectRepo: SupabaseProjectRepository;
  private static _reportRepo: SupabaseReportRepository;
  private static _chatRepo: SupabaseChatRepository;
  private static _knowledgeRepo: SupabaseKnowledgeRepository;
  private static _vectorStore: PineconeVectorStore;
  private static _documentFactory: DocumentStrategyFactory;
  private static _knowledgeService: KnowledgeService;

  private static _jobQueue: TriggerJobQueue;

  private static _reportService: ReportService;
  private static _chatService: ChatService;
  private static _editService: EditService;
  private static _userService: UserService;
  private static _storageService: StorageService;
  private static _photoService: PhotoService;
  private static _statsRepo: SupabaseStatsRepository;
  private static _statsService: StatsService;

  private static _exa: Exa;

  private static _chatOrchestrator: ChatOrchestrator;
  private static _editOrchestrator: EditOrchestrator;
  private static _reportOrchestrator: ReportOrchestrator;
  private static _captureOrchestrator: CaptureOrchestrator;
  private static _captureService: CaptureService;
  private static _projectService: ProjectService;
  private static _captureSessionRepo: SupabaseCaptureSessionRepository;

  private static _specAgent: SpecAgent;
  private static _sitePhotoAgent: SitePhotoAgent;

  static get exa() {
    if (!this._exa) this._exa = new Exa(process.env.EXA_API_KEY!);
    return this._exa;
  }

  // --- 1. The Foundation (Admin Client) ---
  static get adminClient() {
    if (!this._adminClient) {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (!url || !key) throw new Error("Missing Supabase Admin credentials.");

      this._adminClient = createClient(url, key);
    }
    return this._adminClient;
  }
  static get supabase() {
    if (!this._supabase) this._supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    return this._supabase;
  }

  // --- 2. Repositories (Lazy) ---
  static get projectRepo() {
    if (!this._projectRepo) this._projectRepo = new SupabaseProjectRepository();
    return this._projectRepo;
  }

  static get reportRepo() {
    if (!this._reportRepo) this._reportRepo = new SupabaseReportRepository();
    return this._reportRepo;
  }

  static get chatRepo() {
    if (!this._chatRepo) this._chatRepo = new SupabaseChatRepository();
    return this._chatRepo;
  }

  static get knowledgeRepo() {
    if (!this._knowledgeRepo) this._knowledgeRepo = new SupabaseKnowledgeRepository();
    return this._knowledgeRepo;
  }

  static get vectorStore() {
    if (!this._vectorStore) this._vectorStore = new PineconeVectorStore();
    return this._vectorStore;
  }

  // --- 3. Factories & Tools ---
  static get documentFactory() {
    if (!this._documentFactory) this._documentFactory = new DocumentStrategyFactory();
    return this._documentFactory;
  }

  static get knowledgeService() {
    if (!this._knowledgeService) {
      // ⚠️ Notice how we use 'this.adminClient' here to trigger the lazy load safely
      this._knowledgeService = new KnowledgeService(
        this.knowledgeRepo,
        this.vectorStore,
        this.documentFactory,
        this.adminClient,
        this.storageService
      );
    }
    return this._knowledgeService;
  }

  static get jobQueue() {
    if (!this._jobQueue) this._jobQueue = new TriggerJobQueue();
    return this._jobQueue;
  }


  // 🆕 NEW AI-SDK Chat Orchestrator (singleton)
  static get chatOrchestrator() {
    if (!this._chatOrchestrator) {
      this._chatOrchestrator = new ChatOrchestrator();
    }
    return this._chatOrchestrator;
  }

  // 🆕 NEW AI-SDK Chat Service (singleton)
  static get chatService() {
    if (!this._chatService) {
      this._chatService = new ChatService(
        this.chatRepo,
        this.reportService,
        this.chatOrchestrator
      );
    }
    return this._chatService;
  }

  static get editOrchestrator() {
    if (!this._editOrchestrator) {
      this._editOrchestrator = new EditOrchestrator();
    }
    return this._editOrchestrator;
  }

  static get editService() {
    if (!this._editService) {
      this._editService = new EditService(this.editOrchestrator);
    }
    return this._editService;
  }

  static get reportOrchestrator() {
    if (!this._reportOrchestrator) {
      this._reportOrchestrator = new ReportOrchestrator();
    }
    return this._reportOrchestrator;
  }

  static get captureOrchestrator() {
    if (!this._captureOrchestrator) {
      this._captureOrchestrator = new CaptureOrchestrator();
    }
    return this._captureOrchestrator;
  }

  static get captureService() {
    if (!this._captureService) {
      this._captureService = new CaptureService(
        this.captureOrchestrator,
        this.captureSessionRepo,
        this.projectService,
        this.storageService
      );
    }
    return this._captureService;
  }

  static get projectService() {
    if (!this._projectService) {
      this._projectService = new ProjectService(this.projectRepo);
    }
    return this._projectService;
  }

  static get captureSessionRepo() {
    if (!this._captureSessionRepo) {
      this._captureSessionRepo = new SupabaseCaptureSessionRepository();
    }
    return this._captureSessionRepo;
  }

  static get captureSessionService() {
    return this.captureService;
  }

  static get reportService() {
    if (!this._reportService) {
      this._reportService = new ReportService(
        this.reportRepo,
        this.projectRepo,
        this.reportOrchestrator
      );
    }
    return this._reportService;
  }

  static get userService() {
    if (!this._userService) {
      this._userService = new UserService(this.adminClient);
    }
    return this._userService;
  }

  static get storageService() {
    if (!this._storageService) {
      this._storageService = new StorageService();
    }
    return this._storageService;
  }

  // --- 5. Stats (Analytics) ---
  static get statsRepo() {
    if (!this._statsRepo) this._statsRepo = new SupabaseStatsRepository();
    return this._statsRepo;
  }

  static get statsService() {
    if (!this._statsService) {
      this._statsService = new StatsService(this.statsRepo);
    }
    return this._statsService;
  }

  // --- 6. Vision Agent ---
  static get SpecAgent() {
    if (!this._specAgent) {
      this._specAgent = new SpecAgent();
    }
    return this._specAgent;
  }
  static get sitePhotoAgent() {
    if (!this._sitePhotoAgent) {
      this._sitePhotoAgent = new SitePhotoAgent();
    }
    return this._sitePhotoAgent;
  }

  // --- 7. Photo Service ---
  static get photoService() {
    if (!this._photoService) {
      this._photoService = new PhotoService();
    }
    return this._photoService;
  }
}
