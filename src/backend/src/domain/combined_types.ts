// // A conversation history
// export interface ChatSession {
//     sessionId: string;
//     projectId: string;       // Context: Which project is this about?
//     reportId?: string;       // Optional: Which specific report are we editing?
//     userId: string;
    
//     messages: ChatMessage[];
//     startedAt: Date;
//     lastActiveAt: Date;
// }

// // A single message bubble
// export interface ChatMessage {
//     messageId: string;
//     sessionId: string;
//     sender: 'USER' | 'AI';
//     content: string;         // The text displayed
    
//     // AI Metadata (Only present if sender === 'AI')
//     citations?: string[];    // IDs of RAG chunks used to answer
//     suggestion?: EditSuggestion; // If the AI is proposing a text change
    
//     timestamp: Date;
// }

// // The "Smart" part: Structured data for UI Diffing
// export interface EditSuggestion {
//     targetSectionId: string; // Which paragraph/section to change
//     originalText: string;
//     suggestedText: string;
//     reason: string;          // "Correcting grammar" or "Adding missing spec"
//     status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
// }

// // --- PROJECT ROOT ---
// export interface Project {
//     projectId: string;       // UUID
//     organizationId: string;  // For Multi-Tenancy (Security)
//     name: string;
//     status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
    
//     // Composed Objects
//     metadata: ProjectMetadata;
//     jobInfo: JobInfoSheet;
    
//     // Arrays of Assets (Often loaded separately in real DBs, but good for type defs)
//     images?: Image[]; 
//     knowledgeItems?: KnowledgeItem[];
//     createdAt: Date;
//     updatedAt: Date;
// }

// export interface ProjectMetadata {
//     createdDate: Date;
//     createdByUserId: string;
//     lastModifiedDate: Date;
//     status: string
// }

// // --- JOB INFO (From Excel) ---
// export interface JobInfoSheet {
//     clientName: string;
//     siteAddress: string;
//     // Flexible map for other Excel columns (e.g., "Project Manager", "Weather")
//     parsedData: Record<string, string | number>; 
// }

// // --- IMAGES / MEDIA ---
// export interface Image {
//     imageId: string;
//     projectId: string;
//     blobUrl: string;         // URL to S3 / Azure Blob Storage
//     thumbnailUrl?: string;   // Smaller version for UI
//     metadata: ImageMetadata;
// }

// export interface ImageMetadata {
//     uploadedBy: string;
//     capturedAt: Date;        // From EXIF
//     gpsCoordinates?: {       // From EXIF
//         latitude: number;
//         longitude: number;
//     };
//     tags: string[];          // AI Generated (e.g. ["crack", "foundation"])
// }

// // --- KNOWLEDGE (RAG Assets) ---
// export interface KnowledgeItem {
//     kId: string;
//     projectId: string;
//     documentType: 'PDF' | 'CODE_SNIPPET' | 'PREVIOUS_REPORT';
//     originalFileName: string;
//     // We don't store the full vector embeddings here, just the reference
//     processedAt: Date; 
// }

// export enum UserRole {
//     ENGINEER = 'ENGINEER',
//     REVIEWER = 'REVIEWER',
//     ADMIN = 'ADMIN'
// }

// export interface User {
//     userId: string;
//     email: string;
//     fullName: string;
//     passwordHash: string; // In real app, never send this to frontend!
//     roles: UserRole[];
//     isActive: boolean;
// }

// //This defines what a "Document" looks like before and after we chop it up for the AI.

// // 1. The Source Document (e.g., a PDF spec sheet)
// export interface KnowledgeItem {
//     kId: string;             // UUID
//     projectId: string;       // Belongs to a specific project
//     documentType: 'PDF' | 'WORD' | 'WEBSITE';
//     originalFileName: string;
//     content: string;         // The full extracted text
//     uploadedAt: Date;
//     status: 'PROCESSING' | 'INDEXED' | 'FAILED';
// }

// // 2. The Chunk (A small piece of the document for the AI)
// // We search for these "chunks" using math (vectors)
// export interface DocumentChunk {
//     chunkId: string;
//     kId: string;             // Links back to the parent KnowledgeItem
//     textSegment: string;     // The actual text (e.g., "Concrete strength must be 4000psi")
    
//     // The "Embedding" - A list of numbers representing the meaning
//     // (e.g., [0.12, -0.98, 0.44...])
//     embeddingVector?: number[]; 
    
//     metadata: {
//         pageNumber: number;
//         sectionTitle?: string;
//     };
// }

// // --- REPORT ROOT ---
// export interface Report {
//     reportId: string;
//     projectId: string;
//     templateId: string;      // Which structure did we use?
    
//     title: string;
//     status: 'DRAFT' | 'REVIEW' | 'FINAL';
//     versionNumber: number;
    
//     // The Core Content
//     sections: ReportSection[];
    
//     // Audit Trail
//     history?: ReportVersion[]; // Previous snapshots
//     createdAt: Date;
//     updatedAt: Date;
// }

// // --- SECTIONS ---
// export interface ReportSection {
//     id?: string;             // Useful for React keys
//     sectionTitle: string;    // e.g., "3.1 Site Observations"
//     content: string;         // Markdown or HTML text from AI
//     isReviewRequired: boolean;
//     order: number;
    
//     // Images specifically referenced in THIS paragraph
//     images: ReportImageReference[]; 
// }

// export interface ReportImageReference {
//     imageId: string;         // Links back to the Image in Project domain
//     caption: string;         // AI generated caption specific to this context
//     orderIndex: number;      // 0, 1, 2... for layout ordering
// }

// // --- TEMPLATES ---
// export interface ReportTemplate {
//     templateId: string;
//     name: string;            // e.g., "Structural Observation Report"
//     organizationId?: string; // Null = System Default, Set = Custom Org Template
    
//     // Defines the skeleton (e.g., ["Intro", "Observations", "Conclusion"])
//     structureJson: any;      
//     defaultPrompts: string;  // "You are a structural engineer..."
// }

// // --- HISTORY / VERSIONING ---
// export interface ReportVersion {
//     versionNumber: number;
//     savedAt: Date;
//     savedByUserId: string;
//     // A full JSON string of the 'Report' object at that time
//     snapshotJson: string;    
// }