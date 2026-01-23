// --- REPORT ROOT ---
export interface Report {
    reportId: string;
    projectId: string;
    templateId: string;      // Which structure did we use?
    
    title: string;
    status: 'DRAFT' | 'REVIEW' | 'FINAL';
    versionNumber: number;
    
    // The Core Content
    reportContent: MainSectionBlueprint[]; // Legacy JSON structure
    
    // Tiptap-compatible content (Markdown string stored in JSONB)
    tiptapContent?: string; // Markdown text that Tiptap can hydrate
    
    // Audit Trail
    history?: ReportVersion[]; // Previous snapshots
    createdBy: string;       // User ID who created this report
    createdAt: Date;
    updatedAt: Date;
    isReviewRequired: boolean;
    
}
export type MainSectionBlueprint = {
    id?: string; // 🟢 Added ID for editing stability
    title: string;
    description: string; 
    required: boolean;
    order: number;
    children: SubSectionBlueprint[]; // Added optional images array for compatibility
    _reasoning?: string,
};

export type SubSectionBlueprint = {
    title: string;
    description: string; 
    required: boolean;
    order: number;
    children: bulletpointBlueprint[];
    _reasoning?: string,
};

export type bulletpointBlueprint = {
    point: string;
    images: ReportImageReference[];
};

// // --- SECTIONS ---
// export interface ReportSection {
//     id?: string;             // Useful for React keys
//     sectionTitle: string;    // e.g., "3.1 Site Observations"
//     content: string;         // Markdown or HTML text from AI (Legacy/Simple)
//     isReviewRequired: boolean;
//     order: number;
    
//     // Images specifically referenced in THIS paragraph
//     images: ReportImageReference[]; 
// }

export interface ReportImageReference {
    imageId: string;         // Links back to the Image in Project domain
    caption: string;         // AI generated caption specific to this context
    orderIndex: number;      // 0, 1, 2... for layout ordering
    // Hydrated fields
    url?: string;
    description?: string;
    storagePath?: string;
}



// --- HISTORY / VERSIONING ---
export interface ReportVersion {
    versionNumber: number;
    savedAt: Date;
    savedByUserId: string;
    // A full JSON string of the 'Report' object at that time
    snapshotJson: string;    
}