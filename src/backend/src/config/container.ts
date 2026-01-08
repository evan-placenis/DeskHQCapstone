
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
import { createClient } from '@supabase/supabase-js';

// 1. Create the ADMIN client (Service Role)
// ⚠️ NEVER expose this key to the frontend (NEXT_PUBLIC)
const supabaseAdminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Must be the secret key
);


// --- Instantiation ---

// 1. Create the Ingredients (The Repositories)
const chatRepo = new SupabaseChatRepository();
const reportRepo = new SupabaseReportRepository();
const projectRepo = new SupabaseProjectRepository();
const knowledgeRepo = new SupabaseKnowledgeRepository();
const vectorStore = new PineconeVectorStore();

// 2. Create the Tools (AI & Queue)
const documentFactory = new DocumentStrategyFactory();

// KnowledgeService needs Repo + Vector Store + DocumentFactory + Admin Client
// Instantiated BEFORE AgentFactory because AgentFactory needs it
const knowledgeService = new KnowledgeService(knowledgeRepo, vectorStore, documentFactory, supabaseAdminClient);

// AgentFactory needs KnowledgeService
const agentFactory = new AgentFactory(knowledgeService);

//const grokStrategy = agentFactory.createStrategy("GROK")

const chatAgent = new ChatAgent();

const jobQueue = new TriggerJobQueue();

// 3. Assemble the Services (The Chefs)
// ReportService needs repositories to work
const reportService = new ReportService(reportRepo, projectRepo, agentFactory);

// ChatService needs the ReportService to do its job
const chatService = new ChatService(chatRepo, reportService, chatAgent);

// UserService needs Supabase Admin to register users
const userService = new UserService(supabaseAdminClient);

// StorageService for Images
// We instantiate it without a default client, forcing the use of per-request clients (RLS)
const storageService = new StorageService();


// --- Exports ---

// 4. Export the Container (The Bag of Dependencies)
export const Container = {
    // Repos (Optional, but good for debugging)
    projectRepo,
    
    // Strategies
    agentFactory,
    documentFactory,
    
    // Services
    reportService,
    chatService,      // Needed by ChatController
    knowledgeService, // Needed by KnowledgeController
    userService,
    storageService,
    
    // Queue
    jobQueue
};
