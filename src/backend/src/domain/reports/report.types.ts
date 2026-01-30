// --- REPORT ROOT ---
export interface Report {
    reportId: string;
    projectId: string;
    templateId: string;

    title: string;
    status: 'DRAFT' | 'REVIEW' | 'FINAL';
    versionNumber: number;

    // ✅ NEW: The Hybrid Section Array
    // Instead of deep nesting, this is a flat list of "Chunks"
    reportContent: ReportSection[];

    // Tiptap-compatible content (The stitched Markdown)
    tiptapContent?: string;

    // Audit Trail
    history?: ReportVersion[];
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
    isReviewRequired: boolean;
}

// --- ✅ NEW: The "Hybrid" Section Type ---
// This perfectly matches your 'report_sections' table
export interface ReportSection {
    id: string;              // Matches section_id
    title: string;           // Matches heading
    description: string;     // Matches content (The Markdown body)
    order: number;

    // 🛡️ The field your Service was complaining about
    metadata?: ReportSectionMetadata;

    // Optional: Keep for UI state if you have "expand/collapse" in the sidebar
    // But we don't store data here anymore.
    isExpanded?: boolean;
}

// Flexible metadata for your "Business Logic"
export interface ReportSectionMetadata {
    severity?: 'critical' | 'major' | 'minor' | 'info';
    status?: 'compliant' | 'non-compliant' | 'not-inspected';
    tags?: string[];
    [key: string]: any; // Allow any other custom fields
}

// --- HISTORY / VERSIONING ---
export interface ReportVersion {
    versionNumber: number;
    savedAt: Date;
    savedByUserId: string;
    snapshotJson: string;
}
