
import { SupabaseChatRepository } from '../infrastructure/repositories/supabase_repository/SupabaseChatRepository';
import { SupabaseReportRepository } from '../infrastructure/repositories/supabase_repository/SupabaseReportRepository';
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository';
import { SupabaseKnowledgeRepository } from '../infrastructure/repositories/supabase_repository/SupabaseKnowledgeRepository';

//import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient';

import { PineconeVectorStore } from '../infrastructure/vector_store/PineconeVectorStore'; 
import { AgentFactory } from '../AI_Strategies/factory/AgentFactory';
import { DocumentStrategyFactory } from '../Document_Strategies/factory/DocumentFactory';
import { ReportService } from '../Services/ReportService';
import { ChatService } from '../Services/ChatService';
import { ChatAgent } from '../AI_Strategies/ChatSystem/ChatAgent';
import { KnowledgeService } from '../Services/KnowledgeServivce'; 
import { UserService } from '../Services/UserService';
import { StorageService } from '../Services/StorageService';


import { TriggerJobQueue } from '../infrastructure/job/trigger/TriggerJobQueue';
import { Chat } from 'openai/resources/chat';
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
    private static _chatAgent: ChatAgent;
  
    private static _reportService: ReportService;
    private static _chatService: ChatService;
    private static _userService: UserService;
    private static _storageService: StorageService;
  
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
        this._agentFactory = new AgentFactory(this.knowledgeService);
      }
      return this._agentFactory;
    }
    
    static get chatAgent() {
        if (!this._chatAgent) this._chatAgent = new ChatAgent();
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
  }



// // 1. Create the ADMIN client (Service Role)
// // ⚠️ NEVER expose this key to the frontend (NEXT_PUBLIC)
// const supabaseAdminClient = createClient(
//     process.env.NEXT_PUBLIC_SUPABASE_URL!,
//     process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be the secret key
// );


// // --- Instantiation ---

// // 1. Create the Ingredients (The Repositories)
// const chatRepo = new SupabaseChatRepository();
// const reportRepo = new SupabaseReportRepository();
// const projectRepo = new SupabaseProjectRepository();
// const knowledgeRepo = new SupabaseKnowledgeRepository();
// const vectorStore = new PineconeVectorStore();

// // 2. Create the Tools (AI & Queue)
// const documentFactory = new DocumentStrategyFactory();

// // KnowledgeService needs Repo + Vector Store + DocumentFactory + Admin Client
// // Instantiated BEFORE AgentFactory because AgentFactory needs it
// const knowledgeService = new KnowledgeService(knowledgeRepo, vectorStore, documentFactory, supabaseAdminClient);

// // AgentFactory needs KnowledgeService
// const agentFactory = new AgentFactory(knowledgeService);

// //const grokStrategy = agentFactory.createStrategy("GROK")

// const chatAgent = new ChatAgent();

// const jobQueue = new TriggerJobQueue();

// // 3. Assemble the Services (The Chefs)
// // ReportService needs repositories to work
// const reportService = new ReportService(reportRepo, projectRepo, agentFactory);

// // ChatService needs the ReportService to do its job
// const chatService = new ChatService(chatRepo, reportService, chatAgent);

// // UserService needs Supabase Admin to register users
// const userService = new UserService(supabaseAdminClient);

// // StorageService for Images
// // We instantiate it without a default client, forcing the use of per-request clients (RLS)
// const storageService = new StorageService();


// // --- Exports ---

// // 4. Export the Container (The Bag of Dependencies)
// export const Container = {
//     // Repos (Optional, but good for debugging)
//     projectRepo,
    
//     // Strategies
//     agentFactory,
//     documentFactory,
    
//     // Services
//     reportService,
//     chatService,      // Needed by ChatController
//     knowledgeService, // Needed by KnowledgeController
//     userService,
//     storageService,
    
//     // Queue
//     jobQueue
// };
