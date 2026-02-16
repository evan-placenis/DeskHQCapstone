// --- PROJECT ROOT ---
export interface Project {
    projectId: string;       // UUID
    organizationId: string;  // For Multi-Tenancy (Security)
    name: string;
    status: 'ACTIVE' | 'ARCHIVED' | 'COMPLETED';
    
    // Composed Objects
    metadata: ProjectMetadata;
    jobInfo: JobInfoSheet;
    
    // Arrays of Assets (Often loaded separately in real DBs, but good for type defs)
    images?: Image[]; 
    knowledgeItems?: KnowledgeItem[];
    createdAt: Date;
    updatedAt: Date;
}

export interface ProjectMetadata {
    createdAt: Date;
    createdByUserId: string;
    lastModifiedDate: Date;
    status: string
}

// --- JOB INFO (From Excel) ---
export interface JobInfoSheet {
    clientName: string;
    siteAddress: string;
    // Flexible map for other Excel columns (e.g., "Project Manager", "Weather")
    parsedData: Record<string, string | number>; 
}

// --- IMAGES / MEDIA ---
export interface Image {
    imageId: string;
    projectId: string;
    blobUrl: string;         // URL to S3 / Azure Blob Storage
    thumbnailUrl?: string;   // Smaller version for UI
    description?: string;           // User-provided name/description
    metadata: ImageMetadata;
}

export interface ImageMetadata {
    uploadedBy: string;
    capturedAt: Date;        // From EXIF
    gpsCoordinates?: {       // From EXIF
        latitude: number;
        longitude: number;
    };
    tags: string[];          // AI Generated (e.g. ["crack", "foundation"])
}

// --- KNOWLEDGE (RAG Assets) ---
export interface KnowledgeItem {
    kId: string;
    projectId: string;
    documentType: 'PDF' | 'CODE_SNIPPET' | 'PREVIOUS_REPORT';
    originalFileName: string;
    // We don't store the full vector embeddings here, just the reference
    processedAt: Date; 
}