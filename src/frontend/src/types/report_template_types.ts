import type { ReportTemplate } from "./index";
import { ClipboardList } from "lucide-react";

/** Section titles for the Observation Report template */
export const OBSERVATION_REPORT_SECTIONS = [
  { title: "Executive Summary" },
  { title: "Site Conditions" },
  { title: "Observations" },
  { title: "Recommendations" },
] as const;

/** Observation Report template: 4 sections (executive summary, site conditions, observations, recommendations) */
export const OBSERVATION_REPORT_TEMPLATE: ReportTemplate = {
  id: "observation",
  name: "Observation Report",
  description:
    "Standard observation report with executive summary, site conditions, observations, and recommendations.",
  icon: ClipboardList,
  sections: [...OBSERVATION_REPORT_SECTIONS],
};

/** All report templates available in the app (frontend-defined) */
export const REPORT_TEMPLATES: ReportTemplate[] = [OBSERVATION_REPORT_TEMPLATE];
