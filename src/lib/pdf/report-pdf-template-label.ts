import { REPORT_TEMPLATES } from "@/features/reports/services/report-template-types";

/** Human-readable title for PDF header (e.g. "Observation Report"). */
export function templateIdToReportTypeLabel(templateId: string | null | undefined): string {
  const id = typeof templateId === "string" ? templateId.trim() : "";
  if (!id) return "Report";
  const hit = REPORT_TEMPLATES.find((t) => t.id === id);
  if (hit) return hit.name;
  const words = id.replace(/[-_]+/g, " ").trim();
  if (!words) return "Report";
  return `${words.replace(/\b\w/g, (c) => c.toUpperCase())} Report`;
}
