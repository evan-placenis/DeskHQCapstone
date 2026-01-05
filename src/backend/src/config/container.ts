
import { SupabaseChatRepository } from '../infrastructure/repositories/supabase_repository/SupabaseChatRepository';
import { SupabaseReportRepository } from '../infrastructure/repositories/supabase_repository/SupabaseReportRepository';
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository';
import { SupabaseKnowledgeRepository } from '../infrastructure/repositories/supabase_repository/SupabaseKnowledgeRepository';

//import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient';

import { PineconeVectorStore } from '../infrastructure/vector_store/PineconeVectorStore'; 
import { AgentFactory } from '../AI_Strategies/factory/AgentFactory';
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
const agentFactory = new AgentFactory();
//const grokStrategy = agentFactory.createStrategy("GROK")

const chatAgent = new ChatAgent();

const jobQueue = new TriggerJobQueue();

// 3. Assemble the Services (The Chefs)
// ReportService needs repositories to work
const reportService = new ReportService(reportRepo, projectRepo, agentFactory);

// ChatService needs the ReportService to do its job
const chatService = new ChatService(chatRepo, reportService, chatAgent);

// KnowledgeService needs Repo + Vector Store
const knowledgeService = new KnowledgeService(knowledgeRepo, vectorStore);

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
    
    // Services
    reportService,
    chatService,      // Needed by ChatController
    knowledgeService, // Needed by KnowledgeController
    userService,
    storageService,
    
    // Queue
    jobQueue
};













// This is the biggest shift. In software engineering, this is called moving from Tight Coupling to Dependency Injection.

// BEFORE (The "DIY" Approach)
// Every file was responsible for building its own tools.

// The Controller said: "I need a Service, so I will run new Service() right now."

// The Service said: "I need a Repository, so I will run new Repository() right now."

// The Problem: You ended up with multiple copies of everything. If you had 5 requests, you might accidentally create 5 database connections.

// AFTER (The "Container" Approach)
// We moved all the new ...() calls to one single file (container.ts).

// The Container says: "I will build the Repository, the Factory, and the Service once when the app starts."

// The Controller says: "I'll just borrow that finished Service you made."