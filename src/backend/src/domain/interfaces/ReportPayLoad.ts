export interface ReportPayLoad {
  projectId: string;
  userId: string; // Keep this for logging/metadata if needed
  input: {
    reportType: string;
    modelName: string;
    modeName: string;
    selectedImageIds: string[];
    templateId: string;
  };
  notes: {}[];
  writingMode: 'AI_DESIGNED' | 'USER_DEFINED';
    
    // Optional: Only used if mode is USER_DEFINED
    userDefinedGroups?: {
        title: string;
        noteIds: string[]; // The user dragged these notes into this group
        instructions?: string; // "Make this one sound urgent"
    }[];
}

