// // --- 1. The Brain Contract ---
// // Every AI model MUST have a generateContent method.
// export interface AgentStrategy {
//   generateContent(systemPrompt: string, userMessage: string, context: AgentExecutionContext): Promise<string>;
// }

// // --- 2. The Eyes Contract ---
// // Every input mode MUST have a prepareInput method.
// export interface ExecutionModeStrategy {
//   prepareInput(context: AgentExecutionContext): any; // 'any' represents the prompt payload
// }

// // The "Briefcase" of data passed to the AI
// export class AgentExecutionContext {
//   public project: Project;
//   public selectedImages: string[]; // URLs or IDs
//   public retrievedContext: string[]; // Text chunks found via RAG
//   public templateId: any; // The report structure
//   public payload: any;

//   constructor(
//     project: Project,
//     selectedImages: string[],
//     retrievedContext: string[],
//     templateId: any,
//     payload: any
//   ) {
//     this.project = project;
//     this.selectedImages = selectedImages;
//     this.retrievedContext = retrievedContext;
//     this.templateId = templateId;
//     this.payload = payload;
//   }
// }

// export interface ChatRepository {
//     // Find an existing conversation
//     getSessionById(sessionId: string): Promise<ChatSession | null>;
    
//     // Create a new one
//     createSession(session: ChatSession): Promise<void>;
    
//     // Add a message bubble to history
//     addMessage(message: ChatMessage): Promise<void>;
    
//     // (Optional) Get all chats for a project
//     getSessionsByProject(projectId: string): Promise<ChatSession[]>;
// }

// // First, we define the rules for saving chats. We don't care how (Postgres/Mongo), just what needs to happen.

// export interface JobQueue {
//     enqueueReportGeneration(
//         projectId: string, 
//         userId: string, 

//         input: {
//             reportType: string;
//             modelName: string;
//             modeName: string;
//             selectedImageIds: string[];
//             templateId: string;
//         }
//     ): Promise<void>;
// }


// export interface KnowledgeRepository {
//     save(item: KnowledgeItem): Promise<void>;
//     getById(kId: string): Promise<KnowledgeItem | null>;
//     listByProject(projectId: string): Promise<KnowledgeItem[]>;
//     updateStatus(kId: string, status: 'PROCESSING' | 'INDEXED' | 'FAILED'): Promise<void>;
// }


// export interface ProjectRepository {
//     getById(projectId: string): Promise<Project | null>;
//     save(project: Project): Promise<void>;
// }

// export interface ReportPayLoad {
//   projectId: string;
//   userId: string; // Keep this for logging/metadata if needed
//   input: {
//     reportType: string;
//     modelName: string;
//     modeName: string;
//     selectedImageIds: string[];
//     templateId: string;
//   };
//   notes: {}[];
//   writingMode: 'AI_DESIGNED' | 'USER_DEFINED';
    
//     // Optional: Only used if mode is USER_DEFINED
//     userDefinedGroups?: {
//         title: string;
//         noteIds: string[]; // The user dragged these notes into this group
//         instructions?: string; // "Make this one sound urgent"
//     }[];
// }

// // src/domain/reports/ReportRepository.ts


// export interface ReportRepository {
//     // Basic CRUD
//     getById(reportId: string): Promise<Report | null>;
//     save(report: Report): Promise<void>;
//     update(report: Report): Promise<void>;
    
//     // List
//     getByProject(projectId: string): Promise<Report[]>;
    
//     // Versioning (Snapshotting)
//     saveVersion(reportId: string, version: number, snapshot: string): Promise<void>;
// }
// //This is the contract for your vector database (Pinecone, Weaviate, etc.). It says: "I need to save chunks and find similar ones."

// export interface VectorStore {
//     /**
//      * Save chopped up text into the vector DB
//      */
//     upsertChunks(chunks: DocumentChunk[]): Promise<void>;

//     /**
//      * The Magic: Find text relevant to the user's query.
//      * @param vector - The query converted into numbers
//      * @param limit - How many results to return (e.g., top 3)
//      */
//     similaritySearch(query: string, limit: number, filter?: any): Promise<DocumentChunk[]>;
    
//     /**
//      * Delete all chunks for a specific document (e.g., if user deletes a file)
//      */
//     deleteChunks(kId: string): Promise<void>;
// }