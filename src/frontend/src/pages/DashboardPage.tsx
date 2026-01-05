import { AppHeader } from "./smart_components/AppHeader";
import { NewProjectModal } from "./large_modal_components/NewProjectModal";
import { Page } from "@/app/pages/config/routes";
import { Project, PeerReview, User } from "@/frontend/types";
import { Button } from "./ui_components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui_components/card";
import { Badge } from "./ui_components/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui_components/select";
import { Plus, FolderOpen, Camera, FileText, Clock, ArrowRight, TrendingUp, CheckCircle2, AlertCircle, UserCheck, Edit3, Star, CalendarClock } from "lucide-react";
import { useState } from "react";
import { ProjectCard } from "./ui_components/ProjectCard";
import { ReportCard } from "./ui_components/ReportCard";
import { UpcomingReviewCard } from "./shared_ui_components/UpcomingReviewCard";
import { useEffect } from "react";
interface DashboardPageProps {
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onSelectProject: (project: Project) => void;
  onSelectReport: (reportId: number, isPeerReview?: boolean) => void;
  currentUser?: User;
  peerReviews: PeerReview[];
  handleRequestPeerReview: (reportId: number, reportTitle: string, projectName: string, assignedToId: number, assignedToName: string, notes: string) => void;
  onRoleSwitch?: (role: "manager" | "technician") => void;
}

const projects: Project[] = [
  { id: 1, name: "Bridge Inspection - Route 95", status: "Active", lastUpdated: "2025-12-20", reports: 8, photos: 24 },
  { id: 2, name: "Residential Complex - Phase 2", status: "Active", lastUpdated: "2025-12-19", reports: 12, photos: 45 },
  { id: 3, name: "Highway Expansion Project", status: "Active", lastUpdated: "2025-12-18", reports: 15, photos: 67 },
  { id: 4, name: "Water Treatment Facility", status: "Active", lastUpdated: "2025-12-17", reports: 5, photos: 18 },
  { id: 5, name: "Downtown Metro Station", status: "Active", lastUpdated: "2025-12-16", reports: 9, photos: 32 },
  { id: 6, name: "Industrial Park - Building A", status: "Active", lastUpdated: "2025-12-15", reports: 7, photos: 28 },
  { id: 7, name: "Shopping Mall Renovation", status: "Active", lastUpdated: "2025-12-14", reports: 11, photos: 41 },
  { id: 8, name: "Airport Terminal Extension", status: "Active", lastUpdated: "2025-12-13", reports: 14, photos: 55 },
  { id: 9, name: "Coastal Protection Seawall", status: "Active", lastUpdated: "2025-12-12", reports: 6, photos: 22 },
  { id: 10, name: "University Science Building", status: "Active", lastUpdated: "2025-12-11", reports: 10, photos: 38 },
  { id: 11, name: "Hospital Wing Construction", status: "Completed", lastUpdated: "2025-12-10", reports: 13, photos: 48 },
  { id: 12, name: "Office Tower - Downtown", status: "Completed", lastUpdated: "2025-12-09", reports: 8, photos: 30 },
  { id: 13, name: "Parking Structure - Level 5", status: "Completed", lastUpdated: "2025-12-08", reports: 5, photos: 19 },
  { id: 14, name: "Railway Bridge Retrofit", status: "Completed", lastUpdated: "2025-12-07", reports: 9, photos: 35 },
  { id: 15, name: "Wastewater Pump Station", status: "Completed", lastUpdated: "2025-12-06", reports: 7, photos: 25 },
  { id: 16, name: "Stadium Expansion Phase 1", status: "Completed", lastUpdated: "2025-12-05", reports: 12, photos: 44 },
  { id: 17, name: "Tunnel Ventilation System", status: "Completed", lastUpdated: "2025-12-04", reports: 6, photos: 21 },
  { id: 18, name: "Historic Building Restoration", status: "Completed", lastUpdated: "2025-12-03", reports: 10, photos: 37 },
  { id: 19, name: "Dam Safety Assessment", status: "Completed", lastUpdated: "2025-12-02", reports: 8, photos: 29 },
  { id: 20, name: "Wind Farm Installation", status: "Completed", lastUpdated: "2025-12-01", reports: 11, photos: 42 },
  { id: 21, name: "Solar Array Foundation", status: "Active", lastUpdated: "2025-11-30", reports: 5, photos: 17 },
  { id: 22, name: "Pier Reconstruction - Harbor", status: "Active", lastUpdated: "2025-11-29", reports: 9, photos: 33 },
  { id: 23, name: "High-Rise Residential Tower", status: "Active", lastUpdated: "2025-11-28", reports: 16, photos: 58 },
  { id: 24, name: "Convention Center Annex", status: "Active", lastUpdated: "2025-11-27", reports: 7, photos: 26 },
];

const recentReports = [
  { id: 1, title: "Foundation Assessment - Section A", project: "Bridge Inspection - Route 95", projectId: 1, date: "2025-12-20", status: "Draft", inspector: "Sarah Smith", reviewer: "John Pogocar" },
  { id: 2, title: "Concrete Quality Report", project: "Residential Complex - Phase 2", projectId: 2, date: "2025-12-19", status: "Draft", inspector: "Michael Chen", reviewer: "Emily Rodriguez" },
  { id: 3, title: "Safety Observation - Week 44", project: "Highway Expansion Project", projectId: 3, date: "2025-12-18", status: "Draft", inspector: "David Johnson", reviewer: "Sarah Smith" },
  { id: 4, title: "Structural Integrity Analysis", project: "Bridge Inspection - Route 95", projectId: 1, date: "2025-12-17", status: "Draft", inspector: "Sarah Smith", reviewer: "John Pogocar" },
  { id: 5, title: "Water Quality Testing Results", project: "Water Treatment Facility", projectId: 4, date: "2025-12-16", status: "Draft", inspector: "Lisa Anderson", reviewer: "Michael Chen" },
  { id: 6, title: "Metro Station Platform Assessment", project: "Downtown Metro Station", projectId: 5, date: "2025-12-15", status: "Draft", inspector: "Tom Williams", reviewer: "Emily Rodriguez" },
  { id: 7, title: "Building A Foundation Review", project: "Industrial Park - Building A", projectId: 6, date: "2025-12-14", status: "Draft", inspector: "Anna Martinez", reviewer: "David Johnson" },
  { id: 8, title: "Mall Renovation Progress Week 3", project: "Shopping Mall Renovation", projectId: 7, date: "2025-12-13", status: "Draft", inspector: "Robert Lee", reviewer: "Sarah Smith" },
  { id: 9, title: "Terminal Extension Structural Check", project: "Airport Terminal Extension", projectId: 8, date: "2025-12-12", status: "Draft", inspector: "Jennifer Brown", reviewer: "John Pogocar" },
  { id: 10, title: "Seawall Integrity Assessment", project: "Coastal Protection Seawall", projectId: 9, date: "2025-12-11", status: "Draft", inspector: "Chris Taylor", reviewer: "Emily Rodriguez" },
  { id: 11, title: "Science Building Floor Load Test", project: "University Science Building", projectId: 10, date: "2025-12-10", status: "Under Review", inspector: "Patricia Garcia", reviewer: "Michael Chen" },
  { id: 12, title: "Hospital Wing Electrical Systems", project: "Hospital Wing Construction", projectId: 11, date: "2025-12-09", status: "Under Review", inspector: "James Wilson", reviewer: "David Johnson" },
  { id: 13, title: "Office Tower HVAC Analysis", project: "Office Tower - Downtown", projectId: 12, date: "2025-12-08", status: "Under Review", inspector: "Maria Rodriguez", reviewer: "Sarah Smith" },
  { id: 14, title: "Parking Structure Load Assessment", project: "Parking Structure - Level 5", projectId: 13, date: "2025-12-07", status: "Under Review", inspector: "Kevin Zhang", reviewer: "John Pogocar" },
  { id: 15, title: "Railway Bridge Weld Inspection", project: "Railway Bridge Retrofit", projectId: 14, date: "2025-12-06", status: "Under Review", inspector: "Amanda White", reviewer: "Emily Rodriguez" },
  { id: 16, title: "Pump Station Motor Analysis", project: "Wastewater Pump Station", projectId: 15, date: "2025-12-05", status: "Under Review", inspector: "Daniel Park", reviewer: "Michael Chen" },
  { id: 17, title: "Stadium Seating Structural Review", project: "Stadium Expansion Phase 1", projectId: 16, date: "2025-12-04", status: "Under Review", inspector: "Jessica Kim", reviewer: "David Johnson" },
  { id: 18, title: "Tunnel Safety System Check", project: "Tunnel Ventilation System", projectId: 17, date: "2025-12-03", status: "Under Review", inspector: "Ryan Thompson", reviewer: "Sarah Smith" },
  { id: 19, title: "Historic Facade Restoration Report", project: "Historic Building Restoration", projectId: 18, date: "2025-12-02", status: "Under Review", inspector: "Laura Martinez", reviewer: "John Pogocar" },
  { id: 20, title: "Dam Spillway Capacity Analysis", project: "Dam Safety Assessment", projectId: 19, date: "2025-12-01", status: "Under Review", inspector: "Steven Lee", reviewer: "Emily Rodriguez" },
  { id: 21, title: "Wind Turbine Foundation Report", project: "Wind Farm Installation", projectId: 20, date: "2025-11-30", status: "Completed", inspector: "Michelle Chen", reviewer: "Michael Chen" },
  { id: 22, title: "Solar Array Grounding System", project: "Solar Array Foundation", projectId: 21, date: "2025-11-29", status: "Completed", inspector: "Brian Scott", reviewer: "David Johnson" },
  { id: 23, title: "Harbor Pier Concrete Analysis", project: "Pier Reconstruction - Harbor", projectId: 22, date: "2025-11-28", status: "Completed", inspector: "Nicole Brown", reviewer: "Sarah Smith" },
  { id: 24, title: "Tower Steel Frame Inspection", project: "High-Rise Residential Tower", projectId: 23, date: "2025-11-27", status: "Completed", inspector: "Thomas Anderson", reviewer: "John Pogocar" },
  { id: 25, title: "Convention Center Fire Safety", project: "Convention Center Annex", projectId: 24, date: "2025-11-26", status: "Completed", inspector: "Rachel Green", reviewer: "Emily Rodriguez" },
  { id: 26, title: "Bridge Deck Surface Assessment", project: "Bridge Inspection - Route 95", projectId: 1, date: "2025-11-25", status: "Completed", inspector: "Mark Johnson", reviewer: "Michael Chen" },
  { id: 27, title: "Residential Plumbing Systems", project: "Residential Complex - Phase 2", projectId: 2, date: "2025-11-24", status: "Completed", inspector: "Karen Davis", reviewer: "David Johnson" },
  { id: 28, title: "Highway Drainage Evaluation", project: "Highway Expansion Project", projectId: 3, date: "2025-11-23", status: "Completed", inspector: "Paul Miller", reviewer: "Sarah Smith" },
  { id: 29, title: "Treatment Plant Filtration Check", project: "Water Treatment Facility", projectId: 4, date: "2025-11-22", status: "Completed", inspector: "Angela White", reviewer: "John Pogocar" },
  { id: 30, title: "Metro Station Electrical Review", project: "Downtown Metro Station", projectId: 5, date: "2025-11-21", status: "Completed", inspector: "Carlos Rodriguez", reviewer: "Emily Rodriguez" },
];

// Upcoming reviews - AI forecasted based on report patterns
const upcomingReviews = [
  {
    id: 101,
    title: "Weekly Safety Inspection",
    project: "Bridge Inspection - Route 95",
    projectId: 1,
    expectedDate: "2025-11-25",
    inspector: "Sarah Smith",
    reviewer: "John Pogocar",
    confidence: "High"
  },
  {
    id: 102,
    title: "Foundation Progress Report",
    project: "Residential Complex - Phase 2",
    projectId: 2,
    expectedDate: "2025-11-27",
    inspector: "Michael Chen",
    reviewer: "Emily Rodriguez",
    confidence: "Medium"
  },
  {
    id: 103,
    title: "Material Quality Assessment",
    project: "Water Treatment Facility",
    projectId: 4,
    expectedDate: "2025-11-28",
    inspector: "David Johnson",
    reviewer: "Sarah Smith",
    confidence: "High"
  },
];

export function DashboardPage({ 
  onNavigate, 
  onLogout, 
  onSelectProject, 
  onSelectReport, 
  currentUser,
  peerReviews,
  handleRequestPeerReview,
  onRoleSwitch
}: DashboardPageProps) {
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [projectsList, setProjectsList] = useState<Project[]>([]); // Start empty, fetch on load
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Fetch Projects on Mount
  useEffect(() => {
      const fetchProjects = async () => {
          if (!currentUser?.id) return;
          
          try {
              const response = await fetch(`/api/project/list?userId=${currentUser.id}`);
              
              if (response.status === 401) {
                  console.error("Unauthorized: Redirecting to login...");
                  onLogout(); // Or explicit navigate to login
                  return;
              }

              const data = await response.json();
              
              if (response.ok && data.projects) {
                  setProjectsList(data.projects);
              } else {
                  console.error("Failed to fetch projects:", data.error);
                  if (response.status === 404 && data.error.includes("User profile")) {
                      alert("Your user profile is incomplete. Please contact support.");
                  }
              }
          } catch (error) {
              console.error("Error loading projects:", error);
          } finally {
              setIsLoadingProjects(false);
          }
      };

      if (currentUser) {
          fetchProjects();
      }
  }, [currentUser]);

  const totalReports = projectsList.reduce((sum, p) => sum + p.reports, 0);
  const totalPhotos = projectsList.reduce((sum, p) => sum + p.photos, 0);
  const activeProjects = projectsList.filter(p => p.status === "Active").length;

  const handleCreateProject = async (newProject: any) => {
    try {
      console.log("Creating project:", newProject);
      
      // Get the real user ID from local storage (set during login)
      // This is a bridge until we fully refactor the User context/prop types
      let userId: string | undefined;
      if (typeof window !== 'undefined') {
          const storedUser = localStorage.getItem('user');
          if (storedUser && storedUser !== "undefined") {
              try {
                  const userObj = JSON.parse(storedUser);
                  userId = userObj.id || userObj.user?.id; // Handle potential structure variations
              } catch (e) {
                  console.error("Failed to parse stored user", e);
                  localStorage.removeItem('user'); // Clear bad data
              }
          }
      }

      if (!userId) {
          alert("You must be logged in to create a project.");
          return;
      }

      const response = await fetch("/api/project/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: newProject.name,
          clientName: "Mock Client", 
          address: "Mock Address",
          userId: userId // Pass the UUID
        }),
      });

      const data = await response.json();
      console.log("Backend response:", data);

      if (response.ok) {
        alert(`Project created! ID: ${data.project.id}`);
        // Add to local state
        setProjectsList([...projectsList, { ...newProject, id: data.project.id }]);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      alert("Failed to send request to backend");
    }
  };

  const handleProjectStatusChange = (projectId: number, newStatus: string) => {
    setProjectsList(projectsList.map(project =>
      project.id === projectId ? { ...project, status: newStatus } : project
    ));
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader 
        currentPage="dashboard" 
        currentUser={currentUser} 
        onNavigate={onNavigate} 
        onLogout={onLogout} 
        onRoleSwitch={onRoleSwitch}
      />
      
      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-white mb-1 text-xl sm:text-2xl lg:text-3xl font-bold">Welcome back, Engineer</h1>
                <p className="text-white/90 text-sm sm:text-base">Manage your projects and generate AI-powered reports</p>
              </div>
              <Button 
                size="lg" 
                className="bg-white hover:bg-white/90 text-theme-primary rounded-lg shadow-md w-full sm:w-auto h-12 sm:h-auto font-semibold"
                onClick={() => setIsNewProjectModalOpen(true)}
              >
                <Plus className="w-6 h-6 sm:w-7 sm:h-7 mr-2" />
                New Project
              </Button>
            </div>
          </Card>
        </div>

        {/* Peer Review Section - Only show if there are pending reviews */}
        {peerReviews.filter(r => r.assignedToId === currentUser?.id && r.status === "pending").length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
            {/* Peer Review - Left Side (2 columns) */}
            <div className="lg:col-span-2">
              <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary-10">
                <CardHeader className="p-3 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-lg font-bold">
                    <UserCheck className="w-4 h-4 sm:w-5 sm:h-5 text-theme-secondary" />
                    Reports to Peer Review
                    <Badge className="bg-theme-primary text-white rounded-md ml-2 text-xs font-bold">
                      {peerReviews.filter(r => r.assignedToId === currentUser?.id && r.status === "pending").length}
                    </Badge>
                  </CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Colleagues have requested your review on these reports
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-3 sm:p-6 pt-0">
                  <div className="space-y-2 sm:space-y-3 max-h-[280px] sm:max-h-none overflow-y-auto">
                    {peerReviews
                      .filter(r => r.assignedToId === currentUser?.id && r.status === "pending")
                      .map((review) => (
                        <div
                          key={review.id}
                          className="group p-2.5 sm:p-4 bg-white border-2 border-theme-primary-30 rounded-lg sm:rounded-xl hover:border-theme-primary hover:shadow-md transition-all cursor-pointer"
                          onClick={() => onSelectReport(review.reportId, true)}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <h4 className="text-slate-900 mb-1 text-xs sm:text-base line-clamp-1">{review.reportTitle}</h4>
                              <p className="text-[10px] sm:text-sm text-slate-600 mb-1.5 sm:mb-2 line-clamp-1">{review.projectName}</p>
                              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-slate-600">
                                <span className="line-clamp-1">By <span className="font-semibold">{review.requestedByName}</span></span>
                                <span className="hidden sm:inline">•</span>
                                <span>{review.requestDate}</span>
                              </div>
                              {review.requestNotes && (
                                <div className="mt-1.5 sm:mt-2 p-1.5 sm:p-2 bg-slate-50 border border-slate-200 rounded-lg">
                                  <p className="text-[10px] sm:text-xs text-slate-700 italic line-clamp-2">"{review.requestNotes}"</p>
                                </div>
                              )}
                            </div>
                            <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-primary group-hover:translate-x-1 transition-transform flex-shrink-0" />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Monthly Calendar - Right Side */}
            <div className="hidden lg:block">
              <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-white">
                <CardHeader className="p-3 sm:p-4 pb-2">
                  <CardTitle className="text-center text-base sm:text-lg font-bold text-theme-secondary">
                    November 2025
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 sm:p-4 pt-2">
                  {/* Calendar Grid */}
                  <div className="space-y-2">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1">
                      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((day, i) => (
                        <div key={i} className="text-center text-[10px] sm:text-xs font-semibold text-theme-primary py-1">
                          {day}
                        </div>
                      ))}
                    </div>
                    
                    {/* Calendar Days */}
                    <div className="grid grid-cols-7 gap-1">
                      {/* Empty cells for days before month starts (Nov 1, 2025 is Saturday) */}
                      {[...Array(6)].map((_, i) => (
                        <div key={`empty-${i}`} className="aspect-square"></div>
                      ))}
                      
                      {/* Days of the month */}
                      {[...Array(30)].map((_, i) => {
                        const day = i + 1;
                        const isToday = day === 23; // Nov 23, 2025
                        const hasEvent = [10, 15, 25, 27].includes(day); // Sample event days
                        
                        return (
                          <div
                            key={day}
                            className={`aspect-square flex items-center justify-center text-xs sm:text-sm rounded-md transition-all cursor-pointer ${
                              isToday
                                ? 'bg-theme-primary text-white font-bold'
                                : hasEvent
                                ? 'bg-theme-primary-20 text-theme-secondary font-semibold hover:bg-theme-primary-30'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            {day}
                          </div>
                        );
                      })}
                    </div>
                    
                    {/* Legend */}
                    <div className="flex items-center justify-center gap-3 pt-2 text-[10px] text-slate-600">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-theme-primary"></div>
                        <span>Today</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-sm bg-theme-primary-20"></div>
                        <span>Events</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Active Projects */}
          <div className="lg:col-span-2">
            <Card className="rounded-xl shadow-sm border-slate-200 p-[10px] p-[0px]">
              <CardHeader className="p-2 sm:p-6 pb-1 sm:pb-6">
                <CardTitle className="text-base sm:text-xl font-bold">Projects</CardTitle>
                <CardDescription className="text-xs sm:text-sm">All projects organized by status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4 p-2 sm:p-6 pt-1 sm:pt-0">
                {/* Active Projects */}
                {isLoadingProjects ? (
                    <div className="p-8 text-center text-slate-500">Loading projects...</div>
                ) : projectsList.filter(p => p.status === "Active").length > 0 ? (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 px-1">Active Projects</h3>
                    <div className="space-y-1.5 sm:space-y-3 max-h-[500px] overflow-y-auto">
                      {projectsList.filter(p => p.status === "Active").map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onClick={() => onSelectProject(project)}
                          onStatusChange={handleProjectStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                    <div className="p-8 text-center text-slate-500">
                        No active projects found. Create one to get started!
                    </div>
                )}

                {/* Completed Projects */}
                {!isLoadingProjects && projectsList.filter(p => p.status === "Completed").length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-slate-700 mb-2 px-1">Completed Projects</h3>
                    <div className="space-y-1.5 sm:space-y-3 max-h-[500px] overflow-y-auto">
                      {projectsList.filter(p => p.status === "Completed").map((project) => (
                        <ProjectCard
                          key={project.id}
                          project={project}
                          onClick={() => onSelectProject(project)}
                          onStatusChange={handleProjectStatusChange}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Reports */}
          <div className="space-y-4 sm:space-y-6">
            {/* Draft Reports Needing Completion */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-3 sm:p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl font-bold">
                  <Edit3 className="w-4 h-4 sm:w-5 sm:h-5 text-theme-primary" />
                  Draft Reports
                  <Badge className="bg-theme-primary text-white rounded-md ml-auto text-xs font-bold">
                    {recentReports.filter(r => r.status === "Draft").length}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">Reports waiting to be completed</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-2">
                <div className="space-y-1.5 sm:space-y-2 max-h-[500px] overflow-y-auto">
                  {recentReports.filter(r => r.status === "Draft").map((report) => (
                    <ReportCard
                      key={report.id}
                      report={report}
                      onClick={() => onSelectReport(report.id)}
                    />
                  ))}
                  {recentReports.filter(r => r.status === "Draft").length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No draft reports
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Reviews - AI Forecasted */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-3 sm:p-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-xl font-bold">
                  <CalendarClock className="w-4 h-4 sm:w-5 sm:h-5 text-theme-secondary" />
                  Upcoming Reviews
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">AI-forecasted reviews based on report patterns</CardDescription>
              </CardHeader>
              <CardContent className="p-3 sm:p-6 pt-0">
                <div className="space-y-2 sm:space-y-3 max-h-[280px] overflow-y-auto">
                  {upcomingReviews.map((review) => (
                    <UpcomingReviewCard
                      key={review.id}
                      review={review}
                    />
                  ))}
                  {upcomingReviews.length === 0 && (
                    <div className="p-4 text-center text-sm text-slate-500">
                      No upcoming reviews forecasted
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      <NewProjectModal
        open={isNewProjectModalOpen}
        onOpenChange={setIsNewProjectModalOpen}
        onCreateProject={handleCreateProject}
      />
    </div>
  );
}