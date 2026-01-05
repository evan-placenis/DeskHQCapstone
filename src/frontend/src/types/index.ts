export interface PeerReviewComment {
  id: number;
  userId: number;
  userName: string;
  comment: string;
  timestamp: string;
  type: "comment" | "suggestion" | "issue";
  highlightedText?: string; // The text that was highlighted
  sectionId?: number; // Which section the highlight is in
  resolved?: boolean; // Whether the comment has been resolved
}

export interface Project {
  id: string | number;
  name: string;
  reports: number;
  photos: number;
  status: string;
  lastUpdated: string;
  description?: string;
  // Optional fields to match backend structure if needed later
  organizationId?: string;
}

export interface PeerReview {
  id: number;
  reportId: number;
  reportTitle: string;
  projectName: string;
  requestedById: number;
  requestedByName: string;
  assignedToId: number;
  assignedToName: string;
  status: "pending" | "completed";
  requestDate: string;
  completedDate?: string;
  requestNotes?: string;
  comments: PeerReviewComment[];
}

export interface ReportSection {
  id: number;
  title: string;
  content: string;
}

export interface ReportContent {
  title: string;
  date: string;
  location: string;
  engineer: string;
  summary: string;
  sections: ReportSection[];
}

export interface ChatMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  suggestedChanges?: {
    sectionId?: number;
    field?: string;
    oldValue: string;
    newValue: string;
  };
}

export interface User {
  id: number;
  name: string;
  role: "manager" | "technician" | "admin" | "employee";
  team?: string;
  reportsTo?: number;
  email?: string;
}

export interface Photo {
  id: number;
  url: string;
  name: string;
  date: string;
  location: string;
  linkedReport?: string | null;
  description?: string;
  folderId: number;
  caption?: string;
  section?: string;
}

export interface PhotoFolder {
  id: number;
  name: string;
  createdDate: string;
}

export interface KnowledgeDocument {
  id: number;
  name: string;
  type: "specification" | "standard" | "previous_report" | "guideline" | "reference" | "job_sheet" | "other";
  description: string;
  uploadDate: string;
  fileSize: string;
  fileType: string;
}

export interface Report {
  id: number;
  title: string;
  project: string;
  projectId: number;
  date: string;
  status: string;
  inspector: string;
  reviewer: string;
  observations?: number;
  photos?: number;
  engineer?: string;
  summary?: string;
}

export interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  sections: { title: string }[];
}

export interface UpcomingReview {
  id: number;
  title: string;
  project: string;
  projectId: number;
  expectedDate: string;
  inspector: string;
  reviewer: string;
  confidence: string;
}

export interface EmployeeProductivitySummary {
  id: number;
  name: string;
  totalReports: number;
  weeklyAverage: number;
  efficiency: number; // reports per hour
  avgReportTime: number;
  reviewScore: number;
  draftReports: number;
  avgTotalDays: number; // Average total days from site visit to delivery
  avgWritingDays: number; // Average days in writing phase
  avgReviewDays: number; // Average days in review phase
  trend: "up" | "down" | "stable";
  weeklyData: Array<{ week: string; reports: number }>;
  avgProjectTime?: number; 
}
