
import { SupabaseChatRepository } from '../infrastructure/repositories/supabase_repository/SupabaseChatRepository';
import { SupabaseReportRepository } from '../infrastructure/repositories/supabase_repository/SupabaseReportRepository';
import { SupabaseProjectRepository } from '../infrastructure/repositories/supabase_repository/SupbaseProjectRepository';
import { SupabaseKnowledgeRepository } from '../infrastructure/repositories/supabase_repository/SupabaseKnowledgeRepository';

import { supabaseAdmin } from '../infrastructure/supabase/supabaseClient';

import { PineconeVectorStore } from '../infrastructure/vector_store/PineconeVectorStore'; 
import { AgentFactory } from '../AI_Strategies/factory/AgentFactory';
import { ReportService } from '../Services/ReportService';
import { ChatService } from '../Services/ChatService';
import { ChatAgent } from '../AI_Strategies/ChatSystem/ChatAgent';
import { KnowledgeService } from '../Services/KnowledgeServivce'; 
import { UserService } from '../Services/UserService';


import { TriggerJobQueue } from '../infrastructure/job/trigger/TriggerJobQueue';
import { Chat } from 'openai/resources/chat';


// --- Instantiation ---

// 1. Create the Ingredients (The Repositories)
const chatRepo = new SupabaseChatRepository(supabaseAdmin);
const reportRepo = new SupabaseReportRepository(supabaseAdmin);
const projectRepo = new SupabaseProjectRepository(supabaseAdmin);
const knowledgeRepo = new SupabaseKnowledgeRepository(supabaseAdmin);
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

// UserService needs Supabase Admin
const userService = new UserService(supabaseAdmin);


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