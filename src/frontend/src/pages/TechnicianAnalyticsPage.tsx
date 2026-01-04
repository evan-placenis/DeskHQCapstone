import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Badge } from "@/frontend/pages/ui_components/badge";
import { Button } from "@/frontend/pages/ui_components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/pages/ui_components/tabs";
import {
  Clock,
  FileText,
  Zap,
  TrendingUp,
  Award,
  Star,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Timer,
  Target,
  BarChart3,
  Activity,
  FileCheck,
  FileClock,
  Camera,
} from "lucide-react";
import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface User {
  id: number;
  name: string;
  role: "manager" | "technician";
  team?: string;
}

interface TechnicianAnalyticsPageProps {
  currentUser: User;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
  onRoleSwitch?: (role: "manager" | "technician") => void;
}

// Enhanced mock data with comprehensive productivity metrics
const productivityData = {
  // Overall metrics
  overview: {
    totalReports: 47,
    completedThisWeek: 6,
    draftReports: 4,
    averageWeeklyReports: 5.3,
    avgTotalDays: 5.8, // Average total days from site visit to delivery
    avgWritingDays: 3.2, // Average days in writing phase
    avgReviewDays: 2.1, // Average days in review phase
    avgSiteToPhotoUploadDays: 0.5, // Average days from site visit to photo upload
    efficiency: 0.57, // reports per hour
    averageReportTime: 1.75, // hours
    averageReviewScore: 4.6,
    totalReviews: 23,
    totalTimeHours: 120, // Total hours spent
    averageProjectTime: 2.5, // Average time per project
  },

  // Phase duration data - days spent in each phase for recent reports
  phaseDurationData: [
    {
      report: "Foundation - Sec A",
      siteVisit: "Nov 15",
      siteToUpload: 0.5,
      writing: 2.5,
      review: 1.5,
      totalDays: 4.5,
      reviewScore: 4.8,
    },
    {
      report: "Structural Analysis",
      siteVisit: "Nov 12",
      siteToUpload: 1.0,
      writing: 3.5,
      review: 2.0,
      totalDays: 6.5,
      reviewScore: 4.6,
    },
    {
      report: "Material Quality",
      siteVisit: "Nov 10",
      siteToUpload: 0.3,
      writing: 2.8,
      review: 1.8,
      totalDays: 4.9,
      reviewScore: 4.7,
    },
    {
      report: "Safety Check",
      siteVisit: "Nov 8",
      siteToUpload: 0.2,
      writing: 4.2,
      review: 2.8,
      totalDays: 7.2,
      reviewScore: 4.4,
    },
    {
      report: "Phase 2 Inspection",
      siteVisit: "Nov 5",
      siteToUpload: 0.8,
      writing: 3.0,
      review: 2.5,
      totalDays: 6.3,
      reviewScore: 4.5,
    },
    {
      report: "Foundation - Sec B",
      siteVisit: "Nov 3",
      siteToUpload: 0.4,
      writing: 2.2,
      review: 1.2,
      totalDays: 3.8,
      reviewScore: 4.9,
    },
  ],

  weeklyTrend: [
    { week: "W40", reports: 4, hours: 8 },
    { week: "W41", reports: 5, hours: 9 },
    { week: "W42", reports: 6, hours: 10 },
    { week: "W43", reports: 5, hours: 8 },
    { week: "W44", reports: 7, hours: 12 },
    { week: "W45", reports: 6, hours: 11 },
    { week: "W46", reports: 8, hours: 14 },
    { week: "W47", reports: 7, hours: 12 },
    { week: "W48", reports: 5, hours: 9 },
    { week: "W49", reports: 6, hours: 10 },
    { week: "W50", reports: 8, hours: 13 },
    { week: "W51", reports: 7, hours: 12 },
  ],

  // Trend over time - average days per phase by week
  weeklyPhaseTrend: [
    { week: "W45", writing: 3.8, review: 2.5, total: 6.8 },
    { week: "W46", writing: 3.5, review: 2.3, total: 6.3 },
    { week: "W47", writing: 3.2, review: 2.0, total: 5.7 },
    { week: "W48", writing: 3.0, review: 2.2, total: 5.6 },
    { week: "W49", writing: 2.8, review: 1.9, total: 5.2 },
    { week: "W50", writing: 3.2, review: 2.1, total: 5.8 },
    { week: "W51", writing: 3.0, review: 2.0, total: 5.5 },
  ],

  // Distribution of total turnaround time
  turnaroundTimeDistribution: [
    { range: "< 3 days", count: 5, percentage: 11 },
    { range: "3-5 days", count: 18, percentage: 38 },
    { range: "5-7 days", count: 15, percentage: 32 },
    { range: "7-10 days", count: 7, percentage: 15 },
    { range: "> 10 days", count: 2, percentage: 4 },
  ],

  // Report completion time distribution
  completionTimeDistribution: [
    { range: "< 1h", count: 8, percentage: 17 },
    { range: "1-2h", count: 18, percentage: 38 },
    { range: "2-3h", count: 12, percentage: 26 },
    { range: "3-4h", count: 6, percentage: 13 },
    { range: "> 4h", count: 3, percentage: 6 },
  ],

  // Time from photo upload to submission (project timeline)
  projectTimeline: [
    { project: "Bridge-95 Phase 1", photoToSubmit: 24, writingTime: 2.1, reviewTime: 1.5 },
    { project: "Residential Complex", photoToSubmit: 32, writingTime: 2.4, reviewTime: 2.0 },
    { project: "Highway Expansion", photoToSubmit: 28, writingTime: 1.8, reviewTime: 1.2 },
    { project: "Downtown Plaza", photoToSubmit: 36, writingTime: 2.8, reviewTime: 2.5 },
    { project: "Industrial Park", photoToSubmit: 20, writingTime: 1.5, reviewTime: 1.0 },
  ],

  // Review scores over time
  reviewScores: [
    { month: "Jul", score: 4.2, reports: 8 },
    { month: "Aug", score: 4.4, reports: 9 },
    { month: "Sep", score: 4.5, reports: 10 },
    { month: "Oct", score: 4.6, reports: 11 },
    { month: "Nov", score: 4.7, reports: 12 },
  ],

  // Reports per hour trend
  efficiencyTrend: [
    { month: "Jul", efficiency: 0.52 },
    { month: "Aug", efficiency: 0.54 },
    { month: "Sep", efficiency: 0.55 },
    { month: "Oct", efficiency: 0.57 },
    { month: "Nov", efficiency: 0.59 },
  ],

  // Draft reports by project
  draftReports: [
    {
      project: "Bridge Inspection - Route 95",
      reportTitle: "Foundation Assessment - Section B",
      timeSpent: 0.8,
      photosUploaded: 12,
      lastEdited: "2 hours ago",
      daysInDraft: 1,
    },
    {
      project: "Residential Complex - Phase 2",
      reportTitle: "Structural Integrity Check",
      timeSpent: 1.2,
      photosUploaded: 8,
      lastEdited: "1 day ago",
      daysInDraft: 2,
    },
    {
      project: "Highway Expansion Project",
      reportTitle: "Material Quality Report",
      timeSpent: 0.5,
      photosUploaded: 15,
      lastEdited: "3 days ago",
      daysInDraft: 5,
    },
    {
      project: "Downtown Plaza Development",
      reportTitle: "Safety Compliance Observation",
      timeSpent: 0.3,
      photosUploaded: 6,
      lastEdited: "5 days ago",
      daysInDraft: 7,
    },
  ],

  // Report type breakdown
  reportTypeBreakdown: [
    { type: "Foundation", count: 12, avgScore: 4.7, color: "#3b82f6" },
    { type: "Structural", count: 15, avgScore: 4.6, color: "#8b5cf6" },
    { type: "Safety", count: 10, avgScore: 4.8, color: "#10b981" },
    { type: "Material", count: 8, avgScore: 4.4, color: "#f59e0b" },
    { type: "Other", count: 2, avgScore: 4.5, color: "#64748b" },
  ],

  // Recent completed reports with detailed metrics
  recentCompletedReports: [
    {
      title: "Foundation Assessment - Section A",
      project: "Bridge Inspection - Route 95",
      completedDate: "2025-11-20",
      writingTime: 2.1,
      projectTime: 24,
      reviewScore: 4.8,
      reviewer: "John Davis",
      efficiency: 0.62,
    },
    {
      title: "Structural Analysis - Building C",
      project: "Residential Complex - Phase 2",
      completedDate: "2025-11-18",
      writingTime: 1.8,
      projectTime: 32,
      reviewScore: 4.6,
      reviewer: "Michael Chen",
      efficiency: 0.58,
    },
    {
      title: "Safety Observation - Week 46",
      project: "Highway Expansion Project",
      completedDate: "2025-11-15",
      writingTime: 1.2,
      projectTime: 18,
      reviewScore: 5.0,
      reviewer: "Sarah Johnson",
      efficiency: 0.68,
    },
  ],
};

export function TechnicianAnalyticsPage({
  currentUser,
  onNavigate,
  onLogout,
  onRoleSwitch,
}: TechnicianAnalyticsPageProps) {
  const [selectedTimeRange, setSelectedTimeRange] = useState<"week" | "month" | "all">("month");

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        currentPage={currentUser.role === "manager" ? "mystats" : "analytics"}
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
                Productivity & Performance Analytics
              </h1>
              <p className="text-white/90 text-sm sm:text-base">
                Comprehensive insights into your report writing efficiency and quality
              </p>
            </div>
          </div>
        </Card>

        {/* Key Performance Indicators */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-4 mb-6 sm:mb-8">
          {/* Total Reports */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1.5 sm:mb-4 gap-2">
                <div className="w-7 h-7 sm:w-12 sm:h-12 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <FileText className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <Badge variant="secondary" className="rounded-md text-[10px] sm:text-xs">
                  <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5 sm:mr-1" />
                  +12%
                </Badge>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Total Reports</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">
                {productivityData.overview.totalReports}
              </p>
            </CardContent>
          </Card>

          {/* Weekly Average */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1.5 sm:mb-4">
                <div className="w-7 h-7 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Calendar className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-purple-600" />
                </div>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Avg Per Week</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">
                {productivityData.overview.averageWeeklyReports}
              </p>
              <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5 sm:mt-1">reports</p>
            </CardContent>
          </Card>

          {/* Efficiency */}
          <Card className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1.5 sm:mb-4 gap-2">
                <div className="w-7 h-7 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Zap className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-green-600" />
                </div>
                <Badge className="bg-green-600 rounded-md text-[10px] sm:text-xs">Excellent</Badge>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Efficiency</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">
                {productivityData.overview.efficiency.toFixed(2)}
              </p>
              <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5 sm:mt-1">reports/hour</p>
            </CardContent>
          </Card>

          {/* Average Review Score */}
          <Card className="rounded-xl shadow-sm border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1.5 sm:mb-4">
                <div className="w-7 h-7 sm:w-12 sm:h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                  <Award className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-yellow-600" />
                </div>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">Review Score</p>
              <div className="flex items-baseline gap-1 sm:gap-2">
                <p className="text-slate-900 text-xl sm:text-3xl leading-none">
                  {productivityData.overview.averageReviewScore}
                </p>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-2.5 h-2.5 sm:w-4 sm:h-4 ${
                        star <= Math.floor(productivityData.overview.averageReviewScore)
                          ? "fill-yellow-500 text-yellow-500"
                          : "text-slate-300"
                      }`}
                    />
                  ))}
                </div>
              </div>
              <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5 sm:mt-1">
                {productivityData.overview.totalReviews} reviews
              </p>
            </CardContent>
          </Card>

          {/* Draft Reports */}
          <Card className="rounded-xl shadow-sm border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
            <CardContent className="p-2.5 sm:p-6">
              <div className="flex items-center justify-between mb-1.5 sm:mb-4">
                <div className="w-7 h-7 sm:w-12 sm:h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                  <FileClock className="w-3.5 h-3.5 sm:w-6 sm:h-6 text-orange-600" />
                </div>
              </div>
              <p className="text-slate-600 text-[10px] sm:text-sm mb-0.5 sm:mb-1">In Progress</p>
              <p className="text-slate-900 text-xl sm:text-3xl leading-none">
                {productivityData.overview.draftReports}
              </p>
              <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5 sm:mt-1">draft reports</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="performance" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 rounded-lg p-1">
            <TabsTrigger value="performance" className="rounded-md text-xs sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Performance
            </TabsTrigger>
            <TabsTrigger value="time" className="rounded-md text-xs sm:text-sm">
              <Timer className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Time Tracking
            </TabsTrigger>
            <TabsTrigger value="quality" className="rounded-md text-xs sm:text-sm">
              <Target className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Quality
            </TabsTrigger>
            <TabsTrigger value="drafts" className="rounded-md text-xs sm:text-sm">
              <FileCheck className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Drafts
            </TabsTrigger>
          </TabsList>

          {/* Performance Tab */}
          <TabsContent value="performance" className="space-y-4 sm:space-y-6">
            {/* Weekly Productivity Trend */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Weekly Productivity Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Reports completed and hours spent over the last 12 weeks
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={productivityData.weeklyTrend}>
                    <defs>
                      <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="reports"
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorReports)"
                      name="Reports"
                    />
                    <Area
                      type="monotone"
                      dataKey="hours"
                      stroke="#8b5cf6"
                      fillOpacity={1}
                      fill="url(#colorHours)"
                      name="Hours"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Report Type Distribution */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Report Type Distribution</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Breakdown by report category
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={productivityData.reportTypeBreakdown}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ type, percent }) =>
                          `${type} (${(percent * 100).toFixed(0)}%)`
                        }
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="count"
                      >
                        {productivityData.reportTypeBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="mt-4 space-y-2">
                    {productivityData.reportTypeBreakdown.map((item) => (
                      <div key={item.type} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-700">{item.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-slate-600">{item.count} reports</span>
                          <Badge variant="outline" className="rounded-md">
                            <Star className="w-3 h-3 mr-1 fill-yellow-500 text-yellow-500" />
                            {item.avgScore}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Efficiency Trend */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Efficiency Trend</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Reports per hour over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={productivityData.efficiencyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: 12 }} />
                      <YAxis
                        stroke="#64748b"
                        style={{ fontSize: 12 }}
                        domain={[0.4, 0.7]}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="efficiency"
                        stroke="#10b981"
                        strokeWidth={3}
                        dot={{ fill: "#10b981", r: 5 }}
                        name="Reports/Hour"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      <span className="text-sm text-slate-900">
                        <span className="font-semibold">+13.5%</span> efficiency improvement over
                        5 months
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Time Tracking Tab */}
          <TabsContent value="time" className="space-y-4 sm:space-y-6">
            {/* New: Turnaround Time Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="rounded-xl shadow-sm border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Clock className="w-5 h-5 text-blue-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs sm:text-sm mb-1">Avg Total Days</p>
                  <p className="text-slate-900 text-2xl sm:text-3xl leading-none font-bold">
                    {productivityData.overview.avgTotalDays}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Site visit → Delivery</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <FileText className="w-5 h-5 text-purple-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs sm:text-sm mb-1">Avg Writing Days</p>
                  <p className="text-slate-900 text-2xl sm:text-3xl leading-none font-bold">
                    {productivityData.overview.avgWritingDays}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">Draft → Submission</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Timer className="w-5 h-5 text-orange-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs sm:text-sm mb-1">Avg Review Days</p>
                  <p className="text-slate-900 text-2xl sm:text-3xl leading-none font-bold">
                    {productivityData.overview.avgReviewDays}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">In peer review</p>
                </CardContent>
              </Card>

              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <Camera className="w-5 h-5 text-green-600" />
                    </div>
                  </div>
                  <p className="text-slate-600 text-xs sm:text-sm mb-1">Site → Upload</p>
                  <p className="text-slate-900 text-2xl sm:text-3xl leading-none font-bold">
                    {productivityData.overview.avgSiteToPhotoUploadDays}
                  </p>
                  <p className="text-slate-500 text-xs mt-1">days average</p>
                </CardContent>
              </Card>
            </div>

            {/* New: Phase Duration Breakdown - Stacked Bar Chart */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Report Phase Duration Breakdown</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Time spent in each phase from site visit to final delivery (in days)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart
                    data={productivityData.phaseDurationData}
                    layout="vertical"
                    margin={{ left: 100, right: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="report"
                      type="category"
                      stroke="#64748b"
                      style={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="siteToUpload" stackId="a" fill="#10b981" name="Site → Upload" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="writing" stackId="a" fill="#3b82f6" name="Writing Phase" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="review" stackId="a" fill="#8b5cf6" name="Review Phase" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <p className="text-xs text-slate-600">Writing Phase</p>
                    </div>
                    <p className="text-slate-900 text-lg font-semibold">
                      {productivityData.overview.avgWritingDays} days avg
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-3 h-3 rounded-full bg-purple-500" />
                      <p className="text-xs text-slate-600">Review Phase</p>
                    </div>
                    <p className="text-slate-900 text-lg font-semibold">
                      {productivityData.overview.avgReviewDays} days avg
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-3 h-3 text-slate-600" />
                      <p className="text-xs text-slate-600">Total Turnaround</p>
                    </div>
                    <p className="text-slate-900 text-lg font-semibold">
                      {productivityData.overview.avgTotalDays} days avg
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* New: Weekly Phase Trend */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Weekly Turnaround Time Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Average days per phase over the last 7 weeks
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={productivityData.weeklyPhaseTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="week" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="writing"
                      stroke="#3b82f6"
                      strokeWidth={3}
                      dot={{ fill: "#3b82f6", r: 4 }}
                      name="Writing Days"
                    />
                    <Line
                      type="monotone"
                      dataKey="review"
                      stroke="#8b5cf6"
                      strokeWidth={3}
                      dot={{ fill: "#8b5cf6", r: 4 }}
                      name="Review Days"
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{ fill: "#10b981", r: 4 }}
                      name="Total Days"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-slate-900">
                      Your turnaround time improved by <span className="font-semibold">1.3 days</span> in the last 7 weeks
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Turnaround Time Distribution */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">
                  Total Turnaround Time Distribution
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  How long reports take from site visit to final delivery
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productivityData.turnaroundTimeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Reports" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Average Total</p>
                    <p className="text-slate-900 text-xl">
                      {productivityData.overview.avgTotalDays} days
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Fastest Report</p>
                    <p className="text-slate-900 text-xl">2.8 days</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Total Reports</p>
                    <p className="text-slate-900 text-xl">
                      {productivityData.overview.totalReports}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Completion Time Distribution */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">
                  Report Completion Time Distribution
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  How long it takes you to complete reports
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productivityData.completionTimeDistribution}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="range" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis stroke="#64748b" style={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="count" fill="#3b82f6" radius={[8, 8, 0, 0]} name="Reports" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Average Time</p>
                    <p className="text-slate-900 text-xl">
                      {productivityData.overview.averageReportTime}h
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Fastest Report</p>
                    <p className="text-slate-900 text-xl">0.8h</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Total Time</p>
                    <p className="text-slate-900 text-xl">
                      {productivityData.overview.totalTimeHours}h
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Project Timeline - Photo to Submission */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Project Timeline Analysis</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Time from first photo upload to final report submission
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={productivityData.projectTimeline}
                    layout="vertical"
                    margin={{ left: 120 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis type="number" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis
                      dataKey="project"
                      type="category"
                      stroke="#64748b"
                      style={{ fontSize: 11 }}
                      width={120}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Legend />
                    <Bar dataKey="writingTime" stackId="a" fill="#3b82f6" name="Writing Time" />
                    <Bar dataKey="reviewTime" stackId="a" fill="#8b5cf6" name="Review Time" />
                  </BarChart>
                </ResponsiveContainer>
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <span className="text-sm text-slate-900">
                      Average project completion time:{" "}
                      <span className="font-semibold">
                        {productivityData.overview.averageProjectTime}h
                      </span>{" "}
                      from photo upload to submission
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Completed Reports with Time Metrics */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Recent Completed Reports</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Detailed time tracking for your latest submissions
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-3">
                  {productivityData.recentCompletedReports.map((report, index) => (
                    <div
                      key={index}
                      className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <h4 className="text-slate-900 mb-1">{report.title}</h4>
                          <p className="text-sm text-slate-600">{report.project}</p>
                        </div>
                        <Badge className="bg-green-600 rounded-md w-fit">
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Timer className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Writing Time</p>
                          </div>
                          <p className="text-slate-900">{report.writingTime}h</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Camera className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Project Time</p>
                          </div>
                          <p className="text-slate-900">{report.projectTime}h</p>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Efficiency</p>
                          </div>
                          <p className="text-slate-900">{report.efficiency}</p>
                        </div>
                        <div className="p-2 bg-yellow-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Star className="w-3 h-3 text-yellow-600" />
                            <p className="text-xs text-slate-600">Score</p>
                          </div>
                          <p className="text-slate-900">{report.reviewScore}</p>
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <Calendar className="w-3 h-3" />
                        {report.completedDate} • Reviewed by {report.reviewer}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Quality Tab */}
          <TabsContent value="quality" className="space-y-4 sm:space-y-6">
            {/* Review Score Trend */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Review Score Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Your peer review ratings over time
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={productivityData.reviewScores}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="month" stroke="#64748b" style={{ fontSize: 12 }} />
                    <YAxis
                      stroke="#64748b"
                      style={{ fontSize: 12 }}
                      domain={[3.5, 5]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="score"
                      stroke="#f59e0b"
                      strokeWidth={3}
                      dot={{ fill: "#f59e0b", r: 5 }}
                      name="Average Score"
                    />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Current Score</p>
                    <div className="flex items-center gap-1">
                      <p className="text-slate-900 text-xl">
                        {productivityData.overview.averageReviewScore}
                      </p>
                      <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    </div>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Best Score</p>
                    <p className="text-slate-900 text-xl">5.0</p>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Total Reviews</p>
                    <p className="text-slate-900 text-xl">
                      {productivityData.overview.totalReviews}
                    </p>
                  </div>
                  <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                    <p className="text-xs text-slate-600 mb-1">Improvement</p>
                    <p className="text-slate-900 text-xl">+11.9%</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Report Type Quality Breakdown */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Quality by Report Type</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Average review scores for different report categories
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-4">
                  {productivityData.reportTypeBreakdown.map((item) => (
                    <div key={item.type}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="text-slate-900">{item.type}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="rounded-md">
                            {item.count} reports
                          </Badge>
                          <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            <span className="text-sm font-semibold">{item.avgScore}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(item.avgScore / 5) * 100}%`,
                            backgroundColor: item.color,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Drafts Tab */}
          <TabsContent value="drafts" className="space-y-4 sm:space-y-6">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg sm:text-xl">Unfinished Reports</CardTitle>
                    <CardDescription className="text-xs sm:text-sm">
                      Draft reports across all your projects
                    </CardDescription>
                  </div>
                  <Badge className="bg-orange-600 rounded-md">
                    {productivityData.draftReports.length} drafts
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                {productivityData.draftReports.length > 0 ? (
                  <div className="space-y-3">
                    {productivityData.draftReports.map((draft, index) => (
                      <div
                        key={index}
                        className="p-4 border-2 border-orange-200 rounded-xl bg-orange-50 hover:border-orange-300 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <div className="flex-1">
                            <h4 className="text-slate-900 mb-1">{draft.reportTitle}</h4>
                            <p className="text-sm text-slate-600">{draft.project}</p>
                          </div>
                          <Badge
                            variant="outline"
                            className={`rounded-md ${
                              draft.daysInDraft > 5
                                ? "border-red-300 bg-red-50 text-red-700"
                                : "border-orange-300 bg-orange-50 text-orange-700"
                            }`}
                          >
                            {draft.daysInDraft}d in draft
                          </Badge>
                        </div>
                        <div className="grid grid-cols-3 gap-2 mb-3">
                          <div className="p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-1 mb-1">
                              <Timer className="w-3 h-3 text-slate-600" />
                              <p className="text-xs text-slate-600">Time Spent</p>
                            </div>
                            <p className="text-slate-900">{draft.timeSpent}h</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-1 mb-1">
                              <Camera className="w-3 h-3 text-slate-600" />
                              <p className="text-xs text-slate-600">Photos</p>
                            </div>
                            <p className="text-slate-900">{draft.photosUploaded}</p>
                          </div>
                          <div className="p-2 bg-white rounded-lg">
                            <div className="flex items-center gap-1 mb-1">
                              <Clock className="w-3 h-3 text-slate-600" />
                              <p className="text-xs text-slate-600">Last Edit</p>
                            </div>
                            <p className="text-slate-900 text-xs">{draft.lastEdited}</p>
                          </div>
                        </div>
                        <Button className="w-full bg-blue-600 hover:bg-blue-700 rounded-lg">
                          Continue Editing
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-green-600" />
                    </div>
                    <h3 className="text-slate-900 mb-2">All Caught Up!</h3>
                    <p className="text-slate-600 max-w-md mx-auto">
                      You have no draft reports. All your reports are completed and submitted.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}