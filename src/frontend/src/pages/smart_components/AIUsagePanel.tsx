"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/frontend/pages/ui_components/card";
import { Badge } from "@/frontend/pages/ui_components/badge";
import {
    BarChart,
    Bar,
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
import { DollarSign, Cpu, Zap, Hash, Loader2 } from "lucide-react";
import type { AIUsageDashboard } from "@/frontend/lib/useAIUsage";

const CHART_COLORS = ["#3c6e71", "#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#ef4444", "#64748b"];

function formatCost(value: number): string {
    return `$${value.toFixed(4)}`;
}

function formatTokens(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
    return String(value);
}

interface AIUsagePanelProps {
    data: AIUsageDashboard | null;
    loading: boolean;
    error: string | null;
}

export function AIUsagePanel({ data, loading, error }: AIUsagePanelProps) {
    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
                <span className="ml-3 text-slate-500 text-sm">Loading AI usage data...</span>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="rounded-xl border-red-200 bg-red-50">
                <CardContent className="p-6 text-center">
                    <p className="text-red-700 text-sm">{error}</p>
                    <p className="text-red-500 text-xs mt-1">Check that HELICONE_API_KEY is set in your environment.</p>
                </CardContent>
            </Card>
        );
    }

    if (!data) return null;

    const { summary, byModel, byFeature, byUser } = data;

    return (
        <div className="space-y-4 sm:space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                <Card className="rounded-xl shadow-sm border-2 border-emerald-200 bg-gradient-to-br from-emerald-50 to-white">
                    <CardContent className="p-2.5 sm:p-4">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                                <DollarSign className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-emerald-600" />
                            </div>
                        </div>
                        <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Total Spend</p>
                        <p className="text-slate-900 text-lg sm:text-2xl leading-none font-bold">
                            {formatCost(summary.totalCost)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardContent className="p-2.5 sm:p-4">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                                <Hash className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-blue-600" />
                            </div>
                        </div>
                        <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Total Requests</p>
                        <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                            {summary.totalRequests.toLocaleString()}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardContent className="p-2.5 sm:p-4">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                                <Cpu className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-purple-600" />
                            </div>
                        </div>
                        <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Total Tokens</p>
                        <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                            {formatTokens(summary.totalTokens)}
                        </p>
                    </CardContent>
                </Card>

                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardContent className="p-2.5 sm:p-4">
                        <div className="flex items-center justify-between mb-1.5 sm:mb-3">
                            <div className="w-7 h-7 sm:w-10 sm:h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                                <Zap className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-amber-600" />
                            </div>
                        </div>
                        <p className="text-slate-600 text-[10px] sm:text-xs mb-0.5 sm:mb-1">Avg Cost/Request</p>
                        <p className="text-slate-900 text-lg sm:text-2xl leading-none">
                            {summary.totalRequests > 0
                                ? formatCost(summary.totalCost / summary.totalRequests)
                                : "$0.00"}
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                {/* Cost by Model */}
                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">Spend by Model</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Cost distribution across LLM providers
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        {byModel.length > 0 ? (
                            <>
                                <ResponsiveContainer width="100%" height={250}>
                                    <PieChart>
                                        <Pie
                                            data={byModel}
                                            cx="50%"
                                            cy="50%"
                                            outerRadius={80}
                                            dataKey="cost"
                                            nameKey="model"
                                            label={({ model, percent }) =>
                                                `${model} (${(percent * 100).toFixed(0)}%)`
                                            }
                                            labelLine={false}
                                        >
                                            {byModel.map((_entry, i) => (
                                                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                                            ))}
                                        </Pie>
                                        <Tooltip formatter={(value: number) => formatCost(value)} />
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="mt-4 space-y-2">
                                    {byModel.map((m, i) => (
                                        <div key={m.model} className="flex items-center justify-between text-sm">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
                                                <span className="text-slate-700 truncate max-w-[160px]">{m.model}</span>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <span className="text-slate-500 text-xs">{m.totalRequests} reqs</span>
                                                <span className="text-slate-900 font-medium">{formatCost(m.cost)}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-10">No model data yet</p>
                        )}
                    </CardContent>
                </Card>

                {/* Cost by Feature */}
                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">Spend by Feature</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Cost distribution across product features
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        {byFeature.length > 0 ? (
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={byFeature} layout="vertical" margin={{ left: 100 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                    <XAxis type="number" stroke="#64748b" style={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                                    <YAxis dataKey="feature" type="category" stroke="#64748b" style={{ fontSize: 11 }} width={100} />
                                    <Tooltip formatter={(value: number) => formatCost(value)} />
                                    <Bar dataKey="cost" fill="#3c6e71" radius={[0, 8, 8, 0]} name="Cost" />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : (
                            <p className="text-sm text-slate-500 text-center py-10">No feature data yet</p>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* Top Users by Spend */}
            {byUser.length > 0 && (
                <Card className="rounded-xl shadow-sm border-slate-200">
                    <CardHeader className="p-4 sm:p-6">
                        <CardTitle className="text-lg sm:text-xl">Top Users by AI Spend</CardTitle>
                        <CardDescription className="text-xs sm:text-sm">
                            Users ranked by total cost in this period
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 sm:p-6 pt-0">
                        <ResponsiveContainer width="100%" height={Math.max(200, byUser.length * 40)}>
                            <BarChart data={byUser.slice(0, 10)} layout="vertical" margin={{ left: 80 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                                <XAxis type="number" stroke="#64748b" style={{ fontSize: 12 }} tickFormatter={(v) => `$${v.toFixed(2)}`} />
                                <YAxis
                                    dataKey="userId"
                                    type="category"
                                    stroke="#64748b"
                                    style={{ fontSize: 10 }}
                                    width={80}
                                    tickFormatter={(v: string) => v.slice(0, 8) + "..."}
                                />
                                <Tooltip formatter={(value: number) => formatCost(value)} />
                                <Bar dataKey="cost" fill="#3b82f6" radius={[0, 8, 8, 0]} name="Cost" />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            )}

            {/* Data Source Marker */}
            <div className="flex items-center justify-center gap-2 text-xs text-slate-400 pt-2">
                <span>Data source: Helicone</span>
                <span>|</span>
                <span>Cached for 60s</span>
            </div>
        </div>
    );
}
