import { normalizeLabelKey } from "@/lib/excel-parser";
import { escapeHtml } from "./html-escape";

export type PretiumPdfHeaderInput = {
  jobInfoSheet: Record<string, unknown> | null | undefined;
  reportTypeLabel: string;
  reportNumber: number;
  logoDataUrl?: string;
  logoHttpUrl?: string;
};

function dash(v: unknown): string {
  if (v == null) return "-";
  if (Array.isArray(v)) {
    const s = v
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join(", ");
    return s || "-";
  }
  const s = String(v).trim();
  return s || "-";
}

function isTableBlock(v: unknown): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const o = v as Record<string, unknown>;
  return Array.isArray(o.headers) && Array.isArray(o.rows);
}

function stringifyFieldValue(v: unknown): string {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v
      .map((x) => String(x).trim())
      .filter(Boolean)
      .join("\n");
  }
  return String(v).trim();
}

function collectNormalizedFields(
  sheet: Record<string, unknown>
): Map<string, string> {
  const map = new Map<string, string>();
  for (const secVal of Object.values(sheet)) {
    if (!secVal || typeof secVal !== "object" || Array.isArray(secVal)) continue;
    const block = secVal as Record<string, unknown>;
    for (const [rawLabel, val] of Object.entries(block)) {
      if (isTableBlock(val)) continue;
      const nk = normalizeLabelKey(rawLabel);
      if (!nk) continue;
      const s = stringifyFieldValue(val);
      if (s) map.set(nk, s);
    }
  }
  return map;
}

function getFromMap(map: Map<string, string>, ...normalizedKeys: string[]): string {
  for (const k of normalizedKeys) {
    const v = map.get(k);
    if (v && v.trim()) return v.trim();
  }
  return "-";
}

function getSection(
  sheet: Record<string, unknown>,
  title: string
): Record<string, unknown> | null {
  const v = sheet[title];
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  return v as Record<string, unknown>;
}

function buildCompanyHtml(sheet: Record<string, unknown> | null): string {
  if (!sheet) {
    return ["-", "-", "-", "-", "-"].map((x) => escapeHtml(x)).join("<br/>");
  }
  const pa = getSection(sheet, "PA Information");
  const map = collectNormalizedFields(sheet);
  const officeRaw = pa
    ? stringifyFieldValue(
        pa["Office"] ?? pa["office"] ?? pa["Address"] ?? ""
      )
    : "";
  const lines = officeRaw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const l1 = lines[0] ?? "";
  const l2 = lines[1] ?? "";
  const l3 = lines[2] ?? "";
  const tel = (() => {
    if (pa) {
      const t = stringifyFieldValue(
        pa["Tel"] ?? pa["Telephone"] ?? pa["Phone"] ?? ""
      );
      if (t) return t;
    }
    return (
      map.get(normalizeLabelKey("Tel")) ||
      map.get(normalizeLabelKey("Telephone")) ||
      map.get(normalizeLabelKey("Phone")) ||
      ""
    );
  })();
  const web = (() => {
    if (pa) {
      const w = stringifyFieldValue(
        pa["Web Site"] ??
          pa["Website"] ??
          pa["Web"] ??
          pa["www"] ??
          pa["URL"] ??
          ""
      );
      if (w) return w;
    }
    return (
      map.get(normalizeLabelKey("Website")) ||
      map.get(normalizeLabelKey("Web")) ||
      map.get(normalizeLabelKey("www")) ||
      ""
    );
  })();
  const row = (s?: string) => escapeHtml(dash(s));
  return [row(l1), row(l2), row(l3), row(tel), row(web)].join(
    "<br/>"
  );
}

function buildProjectNameRow(map: Map<string, string>): string {
  const title = getFromMap(map, normalizeLabelKey("Project Title"));
  const a1 = getFromMap(map, normalizeLabelKey("Project Address 1"));
  const a2 = getFromMap(map, normalizeLabelKey("Project Address 2"));
  const parts = [title, a1, a2].filter((p) => p !== "-");
  if (parts.length === 0) return "-";
  return parts.join(", ");
}

export function buildPretiumPdfHeaderTemplate(
  input: PretiumPdfHeaderInput
): string {
  const sheet = input.jobInfoSheet;
  const map = sheet ? collectNormalizedFields(sheet) : new Map<string, string>();

  const projectNo = getFromMap(
    map,
    normalizeLabelKey("Project No."),
    normalizeLabelKey("Project No"),
    normalizeLabelKey("Project Code")
  );
  const dateVisit = getFromMap(
    map,
    normalizeLabelKey("Date of Visit"),
    normalizeLabelKey("Date Of Visit"),
    normalizeLabelKey("Visit Date"),
    normalizeLabelKey("Site Visit Date")
  );
  const timeVisit = getFromMap(
    map,
    normalizeLabelKey("Time of Visit"),
    normalizeLabelKey("Time Of Visit"),
    normalizeLabelKey("Visit Time")
  );
  const weather = getFromMap(map, normalizeLabelKey("Weather"));
  const temperature = getFromMap(
    map,
    normalizeLabelKey("Temperature"),
    normalizeLabelKey("Temp")
  );
  const buildPermit = getFromMap(
    map,
    normalizeLabelKey("Build. Permit"),
    normalizeLabelKey("Building Permit"),
    normalizeLabelKey("Permit")
  );
  const crewSize = getFromMap(
    map,
    normalizeLabelKey("Crew Size"),
    normalizeLabelKey("Crew"),
    normalizeLabelKey("Crewsize")
  );
  const projectNameFull = buildProjectNameRow(map);

  const logo =
    input.logoHttpUrl &&
    (input.logoHttpUrl.startsWith("https://") ||
      input.logoHttpUrl.startsWith("http://"))
      ? `<img src="${escapeHtml(input.logoHttpUrl)}" alt="" style="max-height:44px;max-width:160px;object-fit:contain;display:block;" />`
      : input.logoDataUrl
        ? `<img src="${escapeHtml(input.logoDataUrl)}" alt="" style="max-height:44px;max-width:160px;object-fit:contain;display:block;" />`
        : `<span style="font-weight:700;font-size:13px;color:#1e3a5f;letter-spacing:0.02em;">Pretium</span>`;

  const titleRight = `${escapeHtml(input.reportTypeLabel)} ${input.reportNumber}`;

  const border = "#2563eb";
  const labelC = "#334155";
  const valueC = "#1e293b";

  const cell = (label: string, value: string, extra = "") =>
    `<td style="padding:5px 8px;border-top:1px solid #e2e8f0;vertical-align:top;width:25%;${extra}"><span style="color:${labelC};font-weight:600;">${escapeHtml(label)}</span> <span style="color:${valueC};">${escapeHtml(value)}</span></td>`;

  const companyInner = buildCompanyHtml(sheet ?? null);

  return `
<div style="width:100%;box-sizing:border-box;font-family:Arial,Helvetica,sans-serif;font-size:9px;color:#0f172a;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:0 4px;">
  <div style="display:flex;gap:10px;align-items:stretch;margin-bottom:0;">
    <div style="flex:1;border:1px solid ${border};padding:10px 12px;display:flex;align-items:flex-start;gap:12px;min-height:78px;box-sizing:border-box;">
      <div style="flex-shrink:0;">${logo}</div>
      <div style="flex:1;text-align:right;line-height:1.45;color:${border};font-size:8.5px;">${companyInner}</div>
    </div>
    <div style="width:36%;min-width:140px;border:1px solid ${border};padding:10px;display:flex;align-items:center;justify-content:center;text-align:center;box-sizing:border-box;">
      <div style="font-weight:700;font-size:13px;color:${border};line-height:1.25;">${titleRight}</div>
    </div>
  </div>
  <table style="width:100%;border-collapse:collapse;margin-top:0;font-size:8.5px;table-layout:fixed;">
    <tr>
      ${cell("Project No:", projectNo)}
      ${cell("Date of Visit:", dateVisit)}
      ${cell("Time of Visit:", timeVisit)}
      <td style="padding:5px 8px;border-top:1px solid #e2e8f0;text-align:right;vertical-align:top;width:25%;"><span style="color:${labelC};font-weight:600;">Page</span> <span style="color:${valueC};"><span class="pageNumber"></span> of <span class="totalPages"></span></td>
    </tr>
    <tr>
      ${cell("Weather:", weather)}
      ${cell("Temperature:", temperature)}
      ${cell("Build. Permit:", buildPermit)}
      ${cell("Crew Size:", crewSize)}
    </tr>
    <tr>
      <td colspan="4" style="padding:6px 8px;border-top:1px solid #e2e8f0;vertical-align:top;"><span style="color:${labelC};font-weight:600;">Project Name:</span> <span style="color:${valueC};">${escapeHtml(projectNameFull)}</span></td>
    </tr>
  </table>
</div>`.trim();
}
