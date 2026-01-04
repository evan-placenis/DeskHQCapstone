"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Badge } from "@/frontend/pages/ui_components/badge";
import { Button } from "@/frontend/pages/ui_components/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/frontend/pages/ui_components/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/frontend/pages/ui_components/select";
import { AppHeader } from "@/frontend/pages/smart_components/AppHeader";
import { Page } from "@/app/pages/config/routes";
import { User, EmployeeProductivitySummary } from "@/frontend/types";
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
import {
  TrendingUp,
  TrendingDown,
  Users,
  FileText,
  Clock,
  Award,
  Target,
  Star,
  ChevronRight,
  Download,
  Calendar,
  Zap,
  CheckCircle2,
  Timer,
  Camera,
  FileClock,
  Activity,
  Trophy,
  Medal,
  Crown,
} from "lucide-react";

// Enhanced employee productivity data

const mockEmployeeData: EmployeeProductivitySummary[] = [
  {
    id: 1,
    name: "Emily Davis",
    totalReports: 47,
    weeklyAverage: 5.9,
    efficiency: 0.62,
    avgReportTime: 1.6,
    reviewScore: 4.8,
    draftReports: 2,
    avgTotalDays: 24.5,
    avgWritingDays: 10.0,
    avgReviewDays: 5.0,
    trend: "up",
    weeklyData: [
      { week: "W48", reports: 5 },
      { week: "W49", reports: 6 },
      { week: "W50", reports: 7 },
      { week: "W51", reports: 6 },
    ],
    avgProjectTime: 4.2
  },
  {
    id: 2,
    name: "David Wilson",
    totalReports: 42,
    weeklyAverage: 5.3,
    efficiency: 0.57,
    avgReportTime: 1.8,
    reviewScore: 4.6,
    draftReports: 3,
    avgTotalDays: 28.2,
    avgWritingDays: 12.0,
    avgReviewDays: 6.0,
    trend: "up",
    weeklyData: [
      { week: "W48", reports: 4 },
      { week: "W49", reports: 5 },
      { week: "W50", reports: 6 },
      { week: "W51", reports: 6 },
    ],
    avgProjectTime: 4.5
  },
  {
    id: 3,
    name: "Lisa Anderson",
    totalReports: 51,
    weeklyAverage: 6.4,
    efficiency: 0.68,
    avgReportTime: 1.5,
    reviewScore: 4.9,
    draftReports: 1,
    avgTotalDays: 22.0,
    avgWritingDays: 8.0,
    avgReviewDays: 4.0,
    trend: "up",
    weeklyData: [
      { week: "W48", reports: 6 },
      { week: "W49", reports: 7 },
      { week: "W50", reports: 7 },
      { week: "W51", reports: 7 },
    ],
    avgProjectTime: 3.8
  },
  {
    id: 4,
    name: "Tom Martinez",
    totalReports: 35,
    weeklyAverage: 4.4,
    efficiency: 0.45,
    avgReportTime: 2.2,
    reviewScore: 4.2,
    draftReports: 5,
    avgTotalDays: 32.5,
    avgWritingDays: 15.0,
    avgReviewDays: 7.0,
    trend: "stable",
    weeklyData: [
      { week: "W48", reports: 4 },
      { week: "W49", reports: 4 },
      { week: "W50", reports: 5 },
      { week: "W51", reports: 4 },
    ],
    avgProjectTime: 5.1
  },
  {
    id: 5,
    name: "Anna Lee",
    totalReports: 44,
    weeklyAverage: 5.5,
    efficiency: 0.59,
    avgReportTime: 1.7,
    reviewScore: 4.7,
    draftReports: 2,
    avgTotalDays: 26.0,
    avgWritingDays: 11.0,
    avgReviewDays: 5.0,
    trend: "up",
    weeklyData: [
      { week: "W48", reports: 5 },
      { week: "W49", reports: 5 },
      { week: "W50", reports: 6 },
      { week: "W51", reports: 6 },
    ],
    avgProjectTime: 4.0
  },
  {
    id: 6,
    name: "James Brown",
    totalReports: 38,
    weeklyAverage: 4.8,
    efficiency: 0.51,
    avgReportTime: 2.0,
    reviewScore: 4.5,
    draftReports: 4,
    avgTotalDays: 30.0,
    avgWritingDays: 13.0,
    avgReviewDays: 6.0,
    trend: "stable",
    weeklyData: [
      { week: "W48", reports: 4 },
      { week: "W49", reports: 5 },
      { week: "W50", reports: 5 },
      { week: "W51", reports: 5 },
    ],
    avgProjectTime: 4.8
  },
];

// Team aggregate data
const teamWeeklyTrend = [
  { week: "W44", reports: 28, hours: 48.5, avgScore: 4.5 },
  { week: "W45", reports: 32, hours: 52.3, avgScore: 4.6 },
  { week: "W46", reports: 35, hours: 56.8, avgScore: 4.6 },
  { week: "W47", reports: 30, hours: 50.2, avgScore: 4.7 },
  { week: "W48", reports: 28, hours: 47.0, avgScore: 4.6 },
  { week: "W49", reports: 32, hours: 51.5, avgScore: 4.7 },
  { week: "W50", reports: 36, hours: 58.2, avgScore: 4.7 },
  { week: "W51", reports: 34, hours: 54.8, avgScore: 4.8 },
];

const efficiencyDistribution = [
  { range: "0.4-0.5", count: 2, color: "#f59e0b" },
  { range: "0.5-0.6", count: 2, color: "#3c6e71" },
  { range: "0.6-0.7", count: 2, color: "#10b981" },
];

import { ROUTES, getRoute } from "@/app/pages/config/routes";

export function AnalyticsDashboard() {
  const router = useRouter();
  const [timeRange, setTimeRange] = useState("30");
  const [selectedEmployee, setSelectedEmployee] = useState<number | "all">("all");

  const currentUser: User = {
    id: 2,
    name: "Sarah Johnson",
    role: "manager",
    team: "Team A"
  };

  // Calculate team totals
  const teamTotals = {
    totalReports: mockEmployeeData.reduce((sum, emp) => sum + emp.totalReports, 0),
    avgWeeklyReports: mockEmployeeData.reduce((sum, emp) => sum + emp.weeklyAverage, 0) / mockEmployeeData.length,
    avgEfficiency: mockEmployeeData.reduce((sum, emp) => sum + emp.efficiency, 0) / mockEmployeeData.length,
    avgReviewScore: mockEmployeeData.reduce((sum, emp) => sum + emp.reviewScore, 0) / mockEmployeeData.length,
    totalDrafts: mockEmployeeData.reduce((sum, emp) => sum + emp.draftReports, 0),
    teamSize: mockEmployeeData.length,
  };

  // Leaderboard sorted by review score
  const leaderboardByScore = [...mockEmployeeData].sort((a, b) => b.reviewScore - a.reviewScore);
  const leaderboardByEfficiency = [...mockEmployeeData].sort((a, b) => b.efficiency - a.efficiency);
  const leaderboardByReports = [...mockEmployeeData].sort((a, b) => b.totalReports - a.totalReports);

  const handleNavigate = (page: Page) => {
    router.push(getRoute(page));
  };

  const handleLogout = () => {
    router.push(ROUTES.login);
  };

  const onRoleSwitch = (role: "manager" | "technician") => {
    console.log("Switching role to", role);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader
        currentPage="analytics"
        currentUser={currentUser}
        onNavigate={handleNavigate}
        onLogout={handleLogout}
        onRoleSwitch={onRoleSwitch}
      />

      <main className="container mx-auto px-4 sm:px-6 py-4 sm:py-8 max-w-7xl">
        {/* Page Title Banner - Teal with White Text */}
        <Card className="rounded-xl shadow-sm border-2 border-theme-primary bg-theme-primary p-4 sm:p-6 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-white mb-1 text-xl sm:text-2xl lg:text-3xl font-bold">Team Analytics Dashboard</h1>
              <p className="text-white/90 text-sm sm:text-base">Comprehensive team performance insights and metrics</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger className="w-full sm:w-[140px] rounded-lg border-white/40 bg-white/10 hover:bg-white/20 text-white [&>svg]:!text-white [&_[data-slot=select-value]]:!text-white placeholder:!text-white/70">
                  <Calendar className="w-4 h-4 mr-2 text-white" />
                  <SelectValue className="text-white !text-white" />
                </SelectTrigger>
                <SelectContent className="bg-white border-slate-200">
                  <SelectItem value="week" className="text-slate-900 focus:bg-theme-primary-10 focus:text-theme-primary">This Week</SelectItem>
                  <SelectItem value="month" className="text-slate-900 focus:bg-theme-primary-10 focus:text-theme-primary">This Month</SelectItem>
                  <SelectItem value="quarter" className="text-slate-900 focus:bg-theme-primary-10 focus:text-theme-primary">This Quarter</SelectItem>
                  <SelectItem value="year" className="text-slate-900 focus:bg-theme-primary-10 focus:text-theme-primary">This Year</SelectItem>
                </SelectContent>
              </Select>
              <Button 
                variant="outline" 
                className="rounded-lg border-white/40 bg-white/10 text-white hover:bg-white/20 hover:text-white hover:border-white/60 h-10"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </Card>

        {/* Header */}
        <div className="mb-6 sm:mb-8">
          {/* Team KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-2 sm:gap-4">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3 gap-2">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Users className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-primary" />
                  </div>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Team Size</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">{teamTotals.teamSize}</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3 gap-2">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-theme-primary-10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-theme-primary" />
                  </div>
                  <Badge variant="secondary" className="rounded-md text-[9px] sm:text-xs">
                    <TrendingUp className="w-2 h-2 sm:w-3 sm:h-3 mr-0.5" />
                    +15%
                  </Badge>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Total Reports</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                  {teamTotals.totalReports}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-green-100 rounded-lg flex items-center justify-center">
                    <Calendar className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-green-600" />
                  </div>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Avg/Week</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                  {teamTotals.avgWeeklyReports.toFixed(1)}
                </p>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                    <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-cyan-600" />
                  </div>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Efficiency</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                  {teamTotals.avgEfficiency.toFixed(2)}
                </p>
                <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5">rpt/hr</p>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
                    <Award className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-600" />
                  </div>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Avg Score</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                  {teamTotals.avgReviewScore.toFixed(1)}
                </p>
                <div className="flex items-center gap-0.5 mt-0.5">
                  <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-500 text-yellow-500" />
                  <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-500 text-yellow-500" />
                  <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-500 text-yellow-500" />
                  <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-500 text-yellow-500" />
                  <Star className="w-2 h-2 sm:w-3 sm:h-3 fill-yellow-500 text-yellow-500" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-xl shadow-sm border-2 border-orange-200 bg-gradient-to-br from-orange-50 to-white">
              <CardContent className="p-2.5 sm:p-4">
                <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                  <div className="w-7 h-7 sm:w-10 sm:h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                    <FileClock className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-orange-600" />
                  </div>
                </div>
                <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">In Progress</p>
                <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                  {teamTotals.totalDrafts}
                </p>
                <p className="text-slate-500 text-[9px] sm:text-xs mt-0.5">drafts</p>
              </CardContent>
            </Card>
          </div>
        </div>

        <Tabs defaultValue="team" className="space-y-6">
          <TabsList className="bg-white border border-slate-200 rounded-lg p-1">
            <TabsTrigger value="team" className="rounded-md text-xs sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Team Overview
            </TabsTrigger>
            <TabsTrigger value="individuals" className="rounded-md text-xs sm:text-sm">
              <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Individual Stats
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="rounded-md text-xs sm:text-sm">
              <Trophy className="w-3 h-3 sm:w-4 sm:h-4 mr-2" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          {/* Team Overview Tab */}
          <TabsContent value="team" className="space-y-4 sm:space-y-6">
            {/* Team Productivity Trend */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Team Productivity Trend</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Weekly reports and hours across the team (last 8 weeks)
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={teamWeeklyTrend}>
                    <defs>
                      <linearGradient id="colorReports" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3c6e71" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3c6e71" stopOpacity={0} />
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
                      stroke="#3c6e71"
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
              {/* Team Review Score Trend */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Team Review Score Trend</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Average quality scores over time
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <LineChart data={teamWeeklyTrend}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="week" stroke="#64748b" style={{ fontSize: 12 }} />
                      <YAxis stroke="#64748b" style={{ fontSize: 12 }} domain={[4.0, 5.0]} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "white",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                        }}
                      />
                      <Line
                        type="monotone"
                        dataKey="avgScore"
                        stroke="#f59e0b"
                        strokeWidth={3}
                        dot={{ fill: "#f59e0b", r: 5 }}
                        name="Avg Score"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Efficiency Distribution */}
              <Card className="rounded-xl shadow-sm border-slate-200">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="text-lg sm:text-xl">Efficiency Distribution</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Team members by reports/hour
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={efficiencyDistribution}>
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
                      <Bar dataKey="count" radius={[8, 8, 0, 0]} name="Engineers">
                        {efficiencyDistribution.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Individual Stats Tab */}
          <TabsContent value="individuals" className="space-y-4">
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Individual Performance Summary</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Productivity metrics for each team member
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-4">
                  {mockEmployeeData.map((employee) => (
                    <div
                      key={employee.id}
                      className="p-4 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gradient-to-br from-theme-primary to-theme-secondary rounded-full flex items-center justify-center text-white font-semibold">
                            {employee.name
                              .split(" ")
                              .map((n) => n[0])
                              .join("")}
                          </div>
                          <div>
                            <h4 className="text-slate-900 mb-1">{employee.name}</h4>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  employee.trend === "up"
                                    ? "default"
                                    : employee.trend === "down"
                                    ? "destructive"
                                    : "secondary"
                                }
                                className="rounded-md"
                              >
                                {employee.trend === "up" && <TrendingUp className="w-3 h-3 mr-1" />}
                                {employee.trend === "down" && (
                                  <TrendingDown className="w-3 h-3 mr-1" />
                                )}
                                {employee.trend === "up" && "Improving"}
                                {employee.trend === "down" && "Declining"}
                                {employee.trend === "stable" && "Stable"}
                              </Badge>
                              <div className="flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                                <span className="text-sm text-slate-600">{employee.reviewScore}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" className="rounded-lg">
                          <ChevronRight className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Key Metrics Grid */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-3">
                        <div className="p-2 sm:p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <FileText className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Total Reports</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.totalReports}
                          </p>
                        </div>
                        <div className="p-2 sm:p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Calendar className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Weekly Avg</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.weeklyAverage.toFixed(1)}
                          </p>
                        </div>
                        <div className="p-2 sm:p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Zap className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Efficiency</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.efficiency.toFixed(2)}
                          </p>
                        </div>
                        <div className="p-2 sm:p-3 bg-slate-50 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Timer className="w-3 h-3 text-slate-600" />
                            <p className="text-xs text-slate-600">Avg Time</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.avgReportTime}h
                          </p>
                        </div>
                      </div>

                      {/* Additional Metrics */}
                      <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-3">
                        <div className="p-2 sm:p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-1 mb-1">
                            <Camera className="w-3 h-3 text-blue-600" />
                            <p className="text-xs text-slate-600">Project Time</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.avgProjectTime}h
                          </p>
                          <p className="text-xs text-slate-500">photo to submit</p>
                        </div>
                        <div
                          className={`p-2 sm:p-3 rounded-lg ${
                            employee.draftReports > 3
                              ? "bg-orange-50 border border-orange-200"
                              : "bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <FileClock
                              className={`w-3 h-3 ${
                                employee.draftReports > 3 ? "text-orange-600" : "text-slate-600"
                              }`}
                            />
                            <p className="text-xs text-slate-600">In Progress</p>
                          </div>
                          <p className="text-slate-900 text-base sm:text-lg">
                            {employee.draftReports}
                          </p>
                          <p className="text-xs text-slate-500">draft reports</p>
                        </div>
                      </div>

                      {/* Mini Weekly Chart */}
                      <div className="pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-600 mb-2">Last 4 Weeks</p>
                        <ResponsiveContainer width="100%" height={60}>
                          <BarChart data={employee.weeklyData}>
                            <Bar dataKey="reports" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            <XAxis dataKey="week" hide />
                            <YAxis hide />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: "white",
                                border: "1px solid #e2e8f0",
                                borderRadius: "8px",
                                fontSize: "12px",
                              }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Leaderboard Tab */}
          <TabsContent value="leaderboard" className="space-y-4 sm:space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Top Performers by Score */}
              <Card className="rounded-xl shadow-sm border-2 border-yellow-200 bg-gradient-to-br from-yellow-50 to-white">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
                      <Crown className="w-5 h-5 text-yellow-600" />
                    </div>
                    <CardTitle className="text-base sm:text-lg">Top Rated</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    {leaderboardByScore.slice(0, 3).map((employee, index) => (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            index === 0
                              ? "bg-yellow-100 text-yellow-700"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : "bg-orange-100 text-orange-700"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">{employee.name}</p>
                          <div className="flex items-center gap-1">
                            <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                            <span className="text-xs text-slate-600">{employee.reviewScore}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Efficient */}
              <Card className="rounded-xl shadow-sm border-2 border-green-200 bg-gradient-to-br from-green-50 to-white">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                      <Zap className="w-5 h-5 text-green-600" />
                    </div>
                    <CardTitle className="text-base sm:text-lg">Most Efficient</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    {leaderboardByEfficiency.slice(0, 3).map((employee, index) => (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            index === 0
                              ? "bg-green-100 text-green-700"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">{employee.name}</p>
                          <div className="flex items-center gap-1">
                            <Zap className="w-3 h-3 text-green-600" />
                            <span className="text-xs text-slate-600">
                              {employee.efficiency.toFixed(2)} rpt/hr
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Productive */}
              <Card className="rounded-xl shadow-sm border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-white">
                <CardHeader className="p-4 sm:p-6">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Trophy className="w-5 h-5 text-blue-600" />
                    </div>
                    <CardTitle className="text-base sm:text-lg">Most Productive</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6 pt-0">
                  <div className="space-y-3">
                    {leaderboardByReports.slice(0, 3).map((employee, index) => (
                      <div
                        key={employee.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-lg"
                      >
                        <div
                          className={`w-8 h-8 rounded-full flex items-center justify-center font-semibold ${
                            index === 0
                              ? "bg-blue-100 text-blue-700"
                              : index === 1
                              ? "bg-slate-200 text-slate-700"
                              : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-900">{employee.name}</p>
                          <div className="flex items-center gap-1">
                            <FileText className="w-3 h-3 text-blue-600" />
                            <span className="text-xs text-slate-600">
                              {employee.totalReports} reports
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Full Leaderboard */}
            <Card className="rounded-xl shadow-sm border-slate-200">
              <CardHeader className="p-4 sm:p-6">
                <CardTitle className="text-lg sm:text-xl">Complete Team Ranking</CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Sorted by review score
                </CardDescription>
              </CardHeader>
              <CardContent className="p-4 sm:p-6 pt-0">
                <div className="space-y-2">
                  {leaderboardByScore.map((employee, index) => (
                    <div
                      key={employee.id}
                      className="flex items-center gap-3 p-3 border-2 border-slate-200 rounded-xl hover:border-blue-300 hover:bg-blue-50 transition-all"
                    >
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center font-semibold flex-shrink-0 ${
                          index === 0
                            ? "bg-blue-100 text-blue-700"
                            : index === 1
                            ? "bg-slate-200 text-slate-700"
                            : index === 2
                            ? "bg-theme-primary-10 text-theme-primary"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-slate-900 truncate">{employee.name}</p>
                          {employee.trend === "up" && (
                            <Badge
                              variant="outline"
                              className="rounded-md bg-green-50 text-green-700 border-green-200 flex-shrink-0"
                            >
                              <TrendingUp className="w-3 h-3" />
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-3 text-xs text-slate-600">
                          <span>{employee.totalReports} reports</span>
                          <span>•</span>
                          <span>{employee.efficiency.toFixed(2)} rpt/hr</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 px-3 py-1.5 bg-yellow-50 border-2 border-yellow-200 rounded-lg">
                          <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                          <span className="text-slate-900 font-semibold">
                            {employee.reviewScore}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}