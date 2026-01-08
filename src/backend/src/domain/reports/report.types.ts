// --- REPORT ROOT ---
export interface Report {
    reportId: string;
    projectId: string;
    templateId: string;      // Which structure did we use?
    
    title: string;
    status: 'DRAFT' | 'REVIEW' | 'FINAL';
    versionNumber: number;
    
    // The Core Content
    sections: ReportSection[];
    
    // Audit Trail
    history?: ReportVersion[]; // Previous snapshots
    createdAt: Date;
    updatedAt: Date;
}

// --- SECTIONS ---
export interface ReportSection {
    id?: string;             // Useful for React keys
    sectionTitle: string;    // e.g., "3.1 Site Observations"
    content: string;         // Markdown or HTML text from AI
    isReviewRequired: boolean;
    order: number;
    
    // Images specifically referenced in THIS paragraph
    images: ReportImageReference[]; 
}

export interface ReportImageReference {
    imageId: string;         // Links back to the Image in Project domain
    caption: string;         // AI generated caption specific to this context
    orderIndex: number;      // 0, 1, 2... for layout ordering
    // Hydrated fields
    url?: string;
    description?: string;
    storagePath?: string;
}

// --- TEMPLATES ---
export interface ReportTemplate {
    templateId: string;
    name: string;            // e.g., "Structural Observation Report"
    organizationId?: string; // Null = System Default, Set = Custom Org Template
    
    // Defines the skeleton (e.g., ["Intro", "Observations", "Conclusion"])
    structureJson: any;      
    defaultPrompts: string;  // "You are a structural engineer..."
}

// --- HISTORY / VERSIONING ---
export interface ReportVersion {
    versionNumber: number;
    savedAt: Date;
    savedByUserId: string;
    // A full JSON string of the 'Report' object at that time
    snapshotJson: string;    
}