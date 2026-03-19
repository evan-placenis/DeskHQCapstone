import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layouts/app-header";
import { Page } from "@/app/pages/config/routes";
import { apiRoutes } from "@/lib/api-routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Calendar,
  Clock,
  AlertCircle,
  TrendingUp,
  FileText,
  MapPin,
  Users,
  CheckCircle2,
  Loader2,
} from "lucide-react";

interface User {
  id: number;
  name: string;
  role: "manager" | "technician";
  team?: string;
}

interface ReviewerForecastPageProps {
  currentUser: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onRoleSwitch?: (role: "manager" | "technician") => void;
}

interface ActiveSiteWorkItem {
  id: string;
  project: string;
  technician: string;
  startDate: string;
  status: "no-reports" | "drafting" | "awaiting-approval" | "completed";
  daysActive: number;
  totalReports: number;
  reportsDraft: number;
  reportsAwaitingApproval: number;
  reportsCompleted: number;
}

// Mock data for forecasting (sections not yet wired to backend)
const forecastData = {
  currentPending: 3,
  expectedThisWeek: 7,
  expectedNextWeek: 12,
  totalAssignedProjects: 5,
  upcomingSiteVisits: [
    {
      id: 4,
      project: "Water Treatment Facility",
      technician: "David Kim",
      scheduledDate: "2025-11-22",
      expectedReports: 3,
      daysUntil: 3,
    },
    {
      id: 5,
      project: "Industrial Park Renovation",
      technician: "Sarah Martinez",
      scheduledDate: "2025-11-25",
      expectedReports: 5,
      daysUntil: 6,
    },
  ],
  recentlyCompleted: [
    {
      id: 1,
      project: "Downtown Tower Complex",
      technician: "John Davis",
      completedDate: "2025-11-17",
      reportsReviewed: 4,
      rating: 4.5,
    },
    {
      id: 2,
      project: "Riverside Industrial Park",
      technician: "Michael Chen",
      completedDate: "2025-11-15",
      reportsReviewed: 3,
      rating: 5.0,
    },
  ],
  weeklyTrend: [
    { week: "Week 44", reviewed: 5, avg: 3.5 },
    { week: "Week 45", reviewed: 7, avg: 4.2 },
    { week: "Week 46", reviewed: 6, avg: 4.8 },
    { week: "Week 47", reviewed: 3, avg: 5.2 },
  ],
};

export function ReviewerForecastPage({
  currentUser,
  onNavigate,
  onLogout,
  onRoleSwitch,
}: ReviewerForecastPageProps) {
  const [activeSiteWork, setActiveSiteWork] = useState<ActiveSiteWorkItem[]>([]);
  const [isLoadingSiteWork, setIsLoadingSiteWork] = useState(true);

  useEffect(() => {
    async function fetchActiveSiteWork() {
      try {
        const res = await fetch(apiRoutes.project.activeSiteWork);
        if (!res.ok) {
          console.error("Failed to fetch active site work:", res.status);
          return;
        }
        const data = await res.json();
        console.log("[ActiveSiteWork] API response:", JSON.stringify(data, null, 2));
        if (Array.isArray(data.activeSiteWork)) {
          setActiveSiteWork(data.activeSiteWork);
        }
      } catch (err) {
        console.error("Error fetching active site work:", err);
      } finally {
        setIsLoadingSiteWork(false);
      }
    }
    fetchActiveSiteWork();
  }, []);

  const getStatusBadge = (status: ActiveSiteWorkItem["status"]) => {
    switch (status) {
      case "no-reports":
        return (
          <Badge className="bg-slate-500 rounded-md">
            <MapPin className="w-3 h-3 mr-1" />
            No Reports
          </Badge>
        );
      case "drafting":
        return (
          <Badge className="bg-amber-600 rounded-md">
            <FileText className="w-3 h-3 mr-1" />
            Drafting
          </Badge>
        );
      case "awaiting-approval":
        return (
          <Badge className="bg-blue-600 rounded-md">
            <Clock className="w-3 h-3 mr-1" />
            Awaiting Approval
          </Badge>
        );
      case "completed":
        return (
          <Badge className="bg-green-600 rounded-md">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Completed
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        currentPage="reviewer"
        currentUser={currentUser}
        onNavigate={onNavigate}
        onLogout={onLogout}
        onRoleSwitch={onRoleSwitch}
      />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Page Title Banner - Teal with White Text */}
        <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-white mb-1 text-xl sm:text-2xl lg:text-3xl font-bold">
                Reviewer Forecast
              </h1>
              <p className="text-white/90 text-sm sm:text-base">
                Predict upcoming review workload and capacity planning
              </p>
            </div>
          </div>
        </Card>

        {/* Forecast Summary Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4 mb-6 sm:mb-8">
          <Card className="rounded-xl shadow-sm border-2 border-red-200 bg-red-50/30">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <AlertCircle className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-red-600" />
                </div>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Pending Now</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">{forecastData.currentPending}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2">
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-600" />
                </div>
                <Badge variant="outline" className="rounded-md text-[9px] sm:text-xs">This Week</Badge>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Expected Reviews</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">{forecastData.expectedThisWeek}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2 gap-2">
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <TrendingUp className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                </div>
                <Badge variant="outline" className="rounded-md text-[9px] sm:text-xs">Next Week</Badge>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Forecasted Reviews</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">{forecastData.expectedNextWeek}</p>
            </CardContent>
          </Card>

          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1 sm:mb-2">
                <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-primary" />
                </div>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Active Projects</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">{forecastData.totalAssignedProjects}</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 mb-6 sm:mb-8">
          {/* Ongoing Site Visits — wired to real data */}
          <Card className="rounded-xl shadow-sm border-slate-200 lg:col-span-2">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Active Site Work</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Technicians currently on site or drafting reports
              </CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              {isLoadingSiteWork ? (
                <div className="flex items-center justify-center py-12 text-slate-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Loading active site work…</span>
                </div>
              ) : activeSiteWork.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <MapPin className="w-8 h-8 mb-2" />
                  <p className="text-sm">No active site work right now</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeSiteWork.map((visit) => (
                    <div
                      key={visit.id}
                      className="p-3 sm:p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50/30 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-3 gap-2">
                        <div className="flex-1">
                          <h4 className="text-slate-900 mb-1 text-sm sm:text-base">{visit.project}</h4>
                          <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mb-2">
                            <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span>{visit.technician}</span>
                          </div>
                        </div>
                        {getStatusBadge(visit.status)}
                      </div>

                      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-600">Days Active</p>
                          <p className="text-slate-900 text-sm sm:text-base">{visit.daysActive}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-600">Reports</p>
                          <p className="text-slate-900 text-sm sm:text-base">{visit.totalReports}</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <p className="text-xs text-slate-600">Awaiting Approval</p>
                          <p className="text-slate-900 text-sm sm:text-base">{visit.reportsAwaitingApproval}</p>
                        </div>
                      </div>

                      {visit.totalReports > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-slate-600">Completed</span>
                            <span className="text-slate-900">
                              {visit.reportsCompleted} / {visit.totalReports}
                            </span>
                          </div>
                          <Progress
                            value={(visit.reportsCompleted / visit.totalReports) * 100}
                            className="h-2"
                          />
                        </div>
                      )}

                      {visit.status === "awaiting-approval" && (
                        <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                          <span className="text-xs text-blue-700">
                            <AlertCircle className="w-3 h-3 inline mr-1" />
                            Reports awaiting your approval
                          </span>
                          <Badge className="bg-blue-600 text-white rounded-md text-xs w-fit">
                            {visit.reportsAwaitingApproval} pending
                          </Badge>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Site Visits */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Upcoming Site Work</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Scheduled site visits</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3">
                {forecastData.upcomingSiteVisits.map((visit) => (
                  <div
                    key={visit.id}
                    className="p-3 sm:p-4 border-2 border-slate-200 rounded-xl hover:border-slate-300 transition-all"
                  >
                    <h4 className="text-slate-900 mb-2 text-sm sm:text-base">{visit.project}</h4>
                    <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600 mb-3">
                      <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                      <span>{visit.technician}</span>
                    </div>
                    
                    <div className="flex items-center justify-between p-2 bg-slate-50 rounded-lg mb-2">
                      <div className="flex items-center gap-2 text-xs text-slate-600">
                        <Calendar className="w-3 h-3" />
                        <span>{visit.scheduledDate}</span>
                      </div>
                      <Badge variant="outline" className="rounded-md text-xs">
                        In {visit.daysUntil} days
                      </Badge>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">Expected reports</span>
                      <span className="text-slate-900 font-semibold">
                        {visit.expectedReports}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Review History & Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
          {/* Recently Completed */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Recently Completed Reviews</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Your latest peer review completions</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3">
                {forecastData.recentlyCompleted.map((completed) => (
                  <div
                    key={completed.id}
                    className="p-3 sm:p-4 border-2 border-green-200 bg-green-50/30 rounded-xl"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h4 className="text-slate-900 mb-1 text-sm sm:text-base">{completed.project}</h4>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-slate-600">
                          <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span>{completed.technician}</span>
                        </div>
                      </div>
                      <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
                    </div>
                    
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mt-3 pt-3 border-t border-green-200 gap-2">
                      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                        <span className="text-xs text-slate-600">
                          {completed.reportsReviewed} reports reviewed
                        </span>
                        <span className="text-xs text-slate-600">
                          {completed.completedDate}
                        </span>
                      </div>
                      <Badge className="bg-green-600 rounded-md text-xs w-fit">
                        ★ {completed.rating}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Weekly Trend */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-lg sm:text-xl">Review Activity Trend</CardTitle>
              <CardDescription className="text-xs sm:text-sm">Last 4 weeks</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6 pt-0">
              <div className="space-y-3 sm:space-y-4">
                {forecastData.weeklyTrend.map((week, index) => (
                  <div 
                    key={week.week}
                    className={`p-3 sm:p-4 rounded-lg border-2 ${
                      index === forecastData.weeklyTrend.length - 1
                        ? "border-blue-200 bg-blue-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-slate-900 text-sm sm:text-base">{week.week}</span>
                      {index === forecastData.weeklyTrend.length - 1 && (
                        <Badge className="bg-blue-600 rounded-md text-xs">Current</Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs sm:text-sm mb-2">
                      <span className="text-slate-600">{week.reviewed} reviews completed</span>
                      <span className="text-slate-600">★ {week.avg} avg rating</span>
                    </div>
                    <Progress 
                      value={(week.reviewed / 7) * 100} 
                      className="h-1.5"
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}