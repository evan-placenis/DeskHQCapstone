
import { SupabaseChatRepository } from '../infrastructure/repositories/supabase_repository/SupabaseChatRepository';
import { SupabaseReportRepository } from '../infrastructure/repositories/supabase_repository/SupabaseReportRepository';
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository';
import { SupabaseKnowledgeRepository } from '../infrastructure/repositories/supabase_repository/SupabaseKnowledgeRepository';
import { SupabaseStatsRepository } from '../infrastructure/repositories/supabase_repository/SupabaseStatsRepository';

//import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient';

import { PineconeVectorStore } from '../infrastructure/vector_store/PineconeVectorStore';
import { AgentFactory } from '../AI_Strategies/factory/AgentFactory';
import { DocumentStrategyFactory } from '../Document_Strategies/factory/DocumentFactory';
import { ReportService } from '../Services/ReportService';
import { ChatService } from '../Services/ChatService';
import { ChatOrchestrator } from '../AI_Strategies/ChatSystem/core/ChatOrchestrator';
import { ChatServiceNew } from '../Services/ChatService.new';
import { ChatOrchestrator as ChatOrchestratorNew } from '../AI_Skills/orchestrators/ChatOrchestrator';
import { ReportServiceNew } from '../Services/ReportService.new';
import { KnowledgeService } from '../Services/KnowledgeServivce';
import { UserService } from '../Services/UserService';
import { StorageService } from '../Services/StorageService';
import { StatsService } from '../Services/StatsService';
import Exa from "exa-js";


import { TriggerJobQueue } from '../infrastructure/job/trigger/TriggerJobQueue';
import { createClient, SupabaseClient } from "@supabase/supabase-js";


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
  private static _agentFactory: AgentFactory;
  private static _jobQueue: TriggerJobQueue;
  private static _chatAgent: ChatOrchestrator;

  private static _reportService: ReportService;
  private static _chatService: ChatService;
  private static _userService: UserService;
  private static _storageService: StorageService;
  private static _statsRepo: SupabaseStatsRepository;
  private static _statsService: StatsService;

  private static _exa: Exa;

  private static _chatOrchestratorNew: ChatOrchestratorNew;
  private static _chatServiceNew: ChatServiceNew;
  private static _reportServiceNew: ReportServiceNew;

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
        this.adminClient
      );
    }
    return this._knowledgeService;
  }

  static get agentFactory() {
    if (!this._agentFactory) {
      this._agentFactory = new AgentFactory(this.knowledgeService, this.exa);
    }
    return this._agentFactory;
  }

  static get chatAgent() {
    if (!this._chatAgent) {
      this._chatAgent = this.agentFactory.createChatAgent("GROK");
    }
    return this._chatAgent;
  }

  static get jobQueue() {
    if (!this._jobQueue) this._jobQueue = new TriggerJobQueue();
    return this._jobQueue;
  }

  // --- 4. Services (The Chefs) ---
  static get reportService() {
    if (!this._reportService) {
      this._reportService = new ReportService(
        this.reportRepo,
        this.projectRepo,
        this.agentFactory
      );
    }
    return this._reportService;
  }

  static get chatService() {
    if (!this._chatService) {
      this._chatService = new ChatService(
        this.chatRepo,
        this.reportService,
        this.chatAgent
      );
    }
    return this._chatService;
  }

  // 🆕 NEW AI-SDK Chat Orchestrator (singleton)
  static get chatOrchestratorNew() {
    if (!this._chatOrchestratorNew) {
      this._chatOrchestratorNew = new ChatOrchestratorNew();
    }
    return this._chatOrchestratorNew;
  }

  // 🆕 NEW AI-SDK Chat Service (singleton)
  static get chatServiceNew() {
    if (!this._chatServiceNew) {
      this._chatServiceNew = new ChatServiceNew(
        this.chatRepo,
        this.reportService,
        this.chatOrchestratorNew
      );
    }
    return this._chatServiceNew;
  }
  static get reportServiceNew() {
    if (!this._reportServiceNew) {
      this._reportServiceNew = new ReportServiceNew(
        this.reportRepo,
        this.projectRepo,
        this.chatOrchestratorNew
      );
    }
    return this._reportServiceNew;
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
}
