"use client";
import { useState } from "react";
// Component imports
import { LoginPage } from "./components/LoginPage";
import { RegisterPage } from "./components/RegisterPage";
import { SelectOrganizationPage } from "./components/SelectOrganizationPage";
import { OrganizationPasswordPage } from "./components/OrganizationPasswordPage";
import { DashboardPage } from "./components/DashboardPage";
import { ProjectDetailPage } from "./components/ProjectDetailPage";
import { ReportViewerPage } from "./components/ReportViewerPage";
import { AnalyticsDashboard } from "./components/AnalyticsDashboard";
import { TechnicianAnalyticsPage } from "./components/TechnicianAnalyticsPage";
import { ReviewerForecastPage } from "./components/ReviewerForecastPage";
import { SettingsPage } from "./components/SettingsPage";
import { AudioTimelinePage } from "./components/AudioTimelinePage";
import { PeerReviewComment } from "./components/PeerReviewPanel";
import { MobileBottomNav } from "./components/MobileBottomNav";
import { CapturePage } from "./components/CapturePage";

export type Page = "login" | "register" | "select-org" | "org-password" | "dashboard" | "project" | "report" | "analytics" | "mystats" | "reviewer" | "settings" | "audio-timeline";

export interface Project {
  id: number;
  name: string;
  reports: number;
  photos: number;
  status: string;
  lastUpdated: string;
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

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("login");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [fromPeerReview, setFromPeerReview] = useState(false);
  const [showRecordingPage, setShowRecordingPage] = useState(false);
  
  // Registration flow state
  const [registrationData, setRegistrationData] = useState<{
    email: string;
    password: string;
    organizationId: string;
  }>({
    email: "",
    password: "",
    organizationId: ""
  });
  
  // User role state - allows switching between manager and technician
  const [userRole, setUserRole] = useState<"manager" | "technician">("manager");
  
  // Mock current user - in production this would come from auth
  const currentUser = {
    id: 2,
    name: "Sarah Johnson",
    role: userRole,
    team: "Team A",
    reportsTo: 1
  };

  // Mock projects - would come from API in production
  const mockProjects: Project[] = [
    {
      id: 1,
      name: "Downtown Tower Complex",
      reports: 12,
      photos: 156,
      status: "Active",
      lastUpdated: "2025-11-18"
    },
    {
      id: 2,
      name: "Riverside Industrial Park",
      reports: 8,
      photos: 94,
      status: "Active",
      lastUpdated: "2025-11-15"
    },
    {
      id: 3,
      name: "Highway Bridge Inspection",
      reports: 5,
      photos: 67,
      status: "Active",
      lastUpdated: "2025-11-10"
    },
  ];

  // Peer review state
  const [peerReviews, setPeerReviews] = useState<PeerReview[]>([
    {
      id: 1,
      reportId: 1,
      reportTitle: "Foundation Assessment - Phase 1",
      projectName: "Downtown Tower Complex",
      requestedById: 1,
      requestedByName: "John Davis",
      assignedToId: 2,
      assignedToName: "Sarah Johnson",
      status: "pending",
      requestDate: "2025-11-12",
      requestNotes: "Please review the concrete strength test results in Section 3. I want to make sure my analysis is correct before submitting to the client.",
      comments: []
    },
    {
      id: 2,
      reportId: 5,
      reportTitle: "Structural Integrity Analysis",
      projectName: "Riverside Industrial Park",
      requestedById: 3,
      requestedByName: "Michael Chen",
      assignedToId: 2,
      assignedToName: "Sarah Johnson",
      status: "pending",
      requestDate: "2025-11-11",
      requestNotes: "Quick review needed for steel beam calculations.",
      comments: []
    },
  ]);

  const handleRequestPeerReview = (reportId: number, reportTitle: string, projectName: string, assignedToId: number, assignedToName: string, notes: string) => {
    const newReview: PeerReview = {
      id: Math.max(...peerReviews.map(r => r.id), 0) + 1,
      reportId,
      reportTitle,
      projectName,
      requestedById: currentUser.id,
      requestedByName: currentUser.name,
      assignedToId,
      assignedToName,
      status: "pending",
      requestDate: new Date().toISOString().split('T')[0],
      requestNotes: notes,
      comments: []
    };

    setPeerReviews([...peerReviews, newReview]);
  };

  const handleAddReviewComment = (reviewId: number, comment: string, type: PeerReviewComment["type"]) => {
    setPeerReviews(peerReviews.map(review => {
      if (review.id === reviewId) {
        const newComment: PeerReviewComment = {
          id: Math.max(...review.comments.map(c => c.id), 0) + 1,
          userId: currentUser.id,
          userName: currentUser.name,
          comment,
          timestamp: new Date().toLocaleString(),
          type,
          resolved: false
        };
        return {
          ...review,
          comments: [...review.comments, newComment]
        };
      }
      return review;
    }));
  };

  const handleAddHighlightComment = (reviewId: number, highlightedText: string, sectionId: number, comment: string, type: PeerReviewComment["type"]) => {
    setPeerReviews(peerReviews.map(review => {
      if (review.id === reviewId) {
        const newComment: PeerReviewComment = {
          id: Math.max(...review.comments.map(c => c.id), 0) + 1,
          userId: currentUser.id,
          userName: currentUser.name,
          comment,
          timestamp: new Date().toLocaleString(),
          type,
          highlightedText,
          sectionId,
          resolved: false
        };
        return {
          ...review,
          comments: [...review.comments, newComment]
        };
      }
      return review;
    }));
  };

  const handleResolveComment = (reviewId: number, commentId: number) => {
    setPeerReviews(peerReviews.map(review => {
      if (review.id === reviewId) {
        return {
          ...review,
          comments: review.comments.map(c => 
            c.id === commentId ? { ...c, resolved: !c.resolved } : c
          )
        };
      }
      return review;
    }));
  };

  const handleCompleteReview = (reviewId: number) => {
    setPeerReviews(peerReviews.map(review =>
      review.id === reviewId
        ? {
            ...review,
            status: "completed" as const,
            completedDate: new Date().toISOString().split('T')[0]
          }
        : review
    ));
  };

  const handleLogin = () => {
    setIsAuthenticated(true);
    setCurrentPage("dashboard");
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage("login");
    setSelectedProject(null);
    setSelectedReportId(null);
  };

  const handleNavigate = (page: Page) => {
    setCurrentPage(page);
  };

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project);
    setCurrentPage("project");
  };

  const handleSelectReport = (reportId: number, isPeerReview: boolean = false) => {
    setSelectedReportId(reportId);
    setFromPeerReview(isPeerReview);
    setCurrentPage("report");
  };

  const handleBackToDashboard = () => {
    setSelectedProject(null);
    setSelectedReportId(null);
    setFromPeerReview(false);
    setCurrentPage("dashboard");
  };

  const handleBackToProject = () => {
    setSelectedReportId(null);
    setFromPeerReview(false);
    // Ensure we have a selected project, otherwise go to dashboard
    if (selectedProject) {
      setCurrentPage("project");
    } else {
      setCurrentPage("dashboard");
    }
  };

  const handleBackToProjectFromAudio = () => {
    setCurrentPage("project");
  };

  const handleRoleSwitch = (newRole: "manager" | "technician") => {
    setUserRole(newRole);
    // Both managers and technicians can access analytics now
  };

  const handleStartRecording = () => {
    setShowRecordingPage(true);
  };

  const handleSaveRecording = (projectId: number, transcript: string, audioData: any) => {
    // In production, this would save to the backend
    console.log("Saved recording:", { projectId, transcript, audioData });
    setShowRecordingPage(false);
  };

  const handleSaveCapture = (projectId: number, photos: any[], audioTranscript?: string, groupName?: string) => {
    // In production, this would save to the backend
    console.log("Saved capture:", { projectId, photos, audioTranscript, groupName });
    setShowRecordingPage(false);
  };

  const handleCreateProjectFromCapture = () => {
    setShowRecordingPage(false);
    // In production, this would open a create project modal
    console.log("Create new project from capture");
  };

  // Registration flow handlers
  const handleRegisterClick = () => {
    setCurrentPage("register");
  };

  const handleRegisterNext = (email: string, password: string) => {
    setRegistrationData({
      ...registrationData,
      email,
      password
    });
    setCurrentPage("select-org");
  };

  const handleSelectOrganization = (organizationId: string) => {
    setRegistrationData({
      ...registrationData,
      organizationId
    });
    setCurrentPage("org-password");
  };

  const handleCompleteRegistration = () => {
    // In production, this would create the account via API
    console.log("Registration completed:", registrationData);
    setIsAuthenticated(true);
    setCurrentPage("dashboard");
    // Reset registration data
    setRegistrationData({ email: "", password: "", organizationId: "" });
  };

  const handleBackToLogin = () => {
    setCurrentPage("login");
    setRegistrationData({ email: "", password: "", organizationId: "" });
  };

  const handleBackToRegister = () => {
    setCurrentPage("register");
  };

  const handleBackToSelectOrg = () => {
    setCurrentPage("select-org");
  };

  if (!isAuthenticated) {
    if (currentPage === "register") {
      return <RegisterPage onNext={handleRegisterNext} onBack={handleBackToLogin} />;
    }
    if (currentPage === "select-org") {
      return (
        <SelectOrganizationPage 
          email={registrationData.email}
          onNext={handleSelectOrganization}
          onBack={handleBackToRegister}
        />
      );
    }
    if (currentPage === "org-password") {
      return (
        <OrganizationPasswordPage
          email={registrationData.email}
          organizationId={registrationData.organizationId}
          onComplete={handleCompleteRegistration}
          onBack={handleBackToSelectOrg}
        />
      );
    }
    return <LoginPage onLogin={handleLogin} onRegister={handleRegisterClick} />;
  }

  return (
    <>
      {currentPage === "dashboard" && (
        <DashboardPage 
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onSelectProject={handleSelectProject}
          onSelectReport={handleSelectReport}
          currentUser={currentUser}
          peerReviews={peerReviews}
          handleRequestPeerReview={handleRequestPeerReview}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "analytics" && userRole === "manager" && (
        <AnalyticsDashboard
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "analytics" && userRole === "technician" && (
        <TechnicianAnalyticsPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "mystats" && (
        <TechnicianAnalyticsPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "reviewer" && (
        <ReviewerForecastPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "project" && selectedProject && (
        <ProjectDetailPage 
          project={selectedProject}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onBack={handleBackToDashboard}
          onSelectReport={handleSelectReport}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "report" && selectedReportId && (
        <ReportViewerPage 
          reportId={selectedReportId}
          project={selectedProject}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onBack={fromPeerReview ? handleBackToDashboard : handleBackToProject}
          peerReviews={peerReviews}
          handleRequestPeerReview={handleRequestPeerReview}
          handleAddReviewComment={handleAddReviewComment}
          handleAddHighlightComment={handleAddHighlightComment}
          handleResolveComment={handleResolveComment}
          handleCompleteReview={handleCompleteReview}
          fromPeerReview={fromPeerReview}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "settings" && (
        <SettingsPage
          currentUser={currentUser}
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      {currentPage === "audio-timeline" && selectedProject && (
        <AudioTimelinePage
          onNavigate={handleNavigate}
          onLogout={handleLogout}
          onBack={handleBackToProjectFromAudio}
          projectName={selectedProject.name}
          onRoleSwitch={handleRoleSwitch}
        />
      )}
      
      {/* Mobile Bottom Navigation - Shows on all pages except login */}
      <MobileBottomNav
        currentPage={currentPage}
        onNavigate={handleNavigate}
        currentUser={currentUser}
        onRecordClick={handleStartRecording}
      />
      
      {/* Capture Page - Shows as overlay when active */}
      {showRecordingPage && (
        <CapturePage
          onClose={() => setShowRecordingPage(false)}
          onSave={handleSaveCapture}
          onCreateProject={handleCreateProjectFromCapture}
          projects={mockProjects}
        />
      )}
    </>
  );
}