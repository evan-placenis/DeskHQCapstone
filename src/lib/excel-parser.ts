import * as XLSX from "xlsx";
import { z } from "zod";

/**
 * Normalizes a label cell: lowercase, then remove spaces, colons, and non-alphanumeric characters.
 */
export function normalizeLabelKey(label: unknown): string {
  if (label == null) return "";
  const s = String(label).toLowerCase();
  return s.replace(/[\s:]/g, "").replace(/[^a-z0-9]/g, "");
}

function formatCellValue(value: unknown): string {
  if (value == null || value === "") return "";
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return "";
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

function rawLabelText(label: unknown): string {
  if (label == null) return "";
  return String(label).replace(/\r\n/g, "\n").trim();
}

// --- Flat job schema (DB-oriented subset; derived from full workbook) ---

type JobInfoSheetInput = {
  projectName?: string;
  projectCode?: string;
  client?: string;
  projectManager?: string;
  siteLocation?: string;
  startDate?: string;
};

const NORMALIZED_KEY_TO_FIELD = {
  projectname: "projectName",
  projecttitle: "projectName",
  projectcode: "projectCode",
  projectno: "projectCode",
  client: "client",
  clientcompanyname: "client",
  projectmanager: "projectManager",
  name: "projectManager",
  sitelocation: "siteLocation",
  projectaddress1: "siteLocation",
  projectaddress2: "siteLocation",
  startdate: "startDate",
  tendermeetingdatetime: "startDate",
} as const satisfies Record<string, keyof JobInfoSheetInput>;

export const jobInfoSheetSchema = z.object({
  projectName: z.string().optional(),
  projectCode: z.string().optional(),
  client: z.string().optional(),
  projectManager: z.string().optional(),
  siteLocation: z.string().optional(),
  startDate: z.string().optional(),
});

export type JobInfoSheet = z.infer<typeof jobInfoSheetSchema>;

/** One section of the job info workbook (key-value fields, optional tables). */
export type JobInfoSection = {
  fields: Record<string, string | string[]>;
  tables?: JobInfoTable[];
};

export type JobInfoTable = {
  name: string;
  headers: string[];
  rows: Record<string, string>[];
};

export type JobInfoWorkbook = {
  /** Human-readable section title → content */
  sections: Record<string, JobInfoSection>;
  /** Rows that appear before the first section (e.g. sidebar addresses in column F). */
  preamble: Record<string, string | string[]>;
  meta: { sheetName: string; sectionOrder: string[] };
};

// --- Section detection ---

function normalizeSectionKey(header: string): string {
  return normalizeLabelKey(header.replace(/\r\n/g, "\n"));
}

const SECTION_RESOLVERS: Array<{
  test: (n: string) => boolean;
  title: string;
}> = [
  { test: (n) => n === "painformation", title: "PA Information" },
  { test: (n) => n === "clientinformation", title: "Client Information" },
  { test: (n) => n === "projectinformation", title: "Project Information" },
  { test: (n) => n === "ownerinformation", title: "Owner Information" },
  { test: (n) => n.startsWith("contractorinvite"), title: "Contractor Invite" },
  {
    test: (n) => n.startsWith("tendersummary"),
    title: "Tender Summary",
  },
  {
    test: (n) =>
      n.startsWith("contractoraward") || n.startsWith("contractaward"),
    title: "Contractor Award Information",
  },
  {
    test: (n) => n.startsWith("autocad") && n.includes("titleblock"),
    title: "AutoCAD Titleblock Information",
  },
];

function titleFromHeader(raw: string): string {
  const n = normalizeSectionKey(raw);
  const hit = SECTION_RESOLVERS.find((r) => r.test(n));
  if (hit) return hit.title;
  return raw
    .split(/\r\n|\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function firstNonEmptyColumn(row: unknown[]): number {
  if (!Array.isArray(row)) return -1;
  for (let i = 0; i < row.length; i++) {
    if (formatCellValue(row[i]) !== "") return i;
  }
  return -1;
}

function rowPrimaryText(row: unknown[]): string {
  const i = firstNonEmptyColumn(row);
  if (i < 0) return "";
  return rawLabelText(row[i]);
}

/** True if this row is a blue-style section banner (single prominent label, no real value cell). */
function isSectionHeaderRow(row: unknown[]): boolean {
  const text = rowPrimaryText(row);
  if (!text) return false;
  const n = normalizeSectionKey(text);
  if (SECTION_RESOLVERS.some((r) => r.test(n))) return true;
  if (n.includes("information") && n.length >= 12) return true;
  if (n.startsWith("tendersummary")) return true;
  if (n.startsWith("contractorinvite")) return true;
  return false;
}

function pickLabelValuePair(
  row: unknown[]
): { label: unknown; value: unknown; value2?: unknown; labelCol: number } | null {
  if (!Array.isArray(row) || row.length === 0) return null;
  const a = row[0];
  const b = row[1];
  const c = row[2];
  const d = row[3];
  if (normalizeLabelKey(a) !== "") {
    return {
      label: a,
      value: row.length > 1 ? b : null,
      value2: d !== undefined && formatCellValue(d) !== "" ? d : undefined,
      labelCol: 0,
    };
  }
  if (normalizeLabelKey(b) !== "") {
    return {
      label: b,
      value: c ?? null,
      value2: d !== undefined && formatCellValue(d) !== "" ? d : undefined,
      labelCol: 1,
    };
  }
  return null;
}

/** Value-only continuation row (multi-line office address, etc.). */
function continuationText(row: unknown[], labelCol: 0 | 1): string | null {
  if (!Array.isArray(row)) return null;
  const valueIdx = labelCol === 0 ? 1 : 2;
  const v = formatCellValue(row[valueIdx]);
  const labelIdx = labelCol;
  if (normalizeLabelKey(row[labelIdx]) !== "") return null;
  if (v === "") return null;
  for (let i = 0; i < labelIdx; i++) {
    if (formatCellValue(row[i]) !== "") return null;
  }
  for (let i = labelIdx + 1; i < valueIdx; i++) {
    if (formatCellValue(row[i]) !== "") return null;
  }
  return v;
}

function putField(
  fields: Record<string, string | string[]>,
  rawKey: string,
  value: string,
  mode: "set" | "append" | "duplicate"
) {
  if (mode === "append") {
    const cur = fields[rawKey];
    if (cur === undefined) fields[rawKey] = value;
    else if (typeof cur === "string") fields[rawKey] = `${cur}\n${value}`.trim();
    else fields[rawKey] = [...cur, value].join("\n");
    return;
  }
  if (mode === "duplicate") {
    const cur = fields[rawKey];
    if (cur === undefined) fields[rawKey] = value;
    else if (typeof cur === "string") fields[rawKey] = [cur, value];
    else cur.push(value);
    return;
  }
  fields[rawKey] = value;
}

/** Header row for the bid grid (exact label + total/stipulated price column). */
function isTenderBidTableHeader(b: string, c: string): boolean {
  const lb = b.trim().toLowerCase();
  const lc = c.trim().toLowerCase();
  return lb === "contractor name" && lc.includes("total") && lc.includes("stipul");
}

function isTenderPostTableFieldLabel(rawLabel: string): boolean {
  const n = normalizeLabelKey(rawLabel);
  return (
    n === "specificationdate" ||
    n === "tenderdate" ||
    n === "awardedcontractamount"
  );
}

function parseContractorInviteRow(row: unknown[]): Record<string, string> | null {
  if (!Array.isArray(row)) return null;
  const b = formatCellValue(row[1]);
  const c = formatCellValue(row[2]);
  const d = formatCellValue(row[3]);
  if (b === "" && c === "" && d === "") return null;
  return {
    "Contractor Name": b,
    "Contractor Contact Name": c,
    Email: d,
  };
}

function applyKeyValueToSection(
  sections: Record<string, JobInfoSection>,
  sectionOrder: string[],
  currentTitle: string,
  pair: { label: unknown; value: unknown; value2?: unknown; labelCol: number }
): { rawKey: string; labelCol: 0 | 1 } {
  const rawKey = rawLabelText(pair.label);
  const vMain = formatCellValue(pair.value);
  const vHint = pair.value2 !== undefined ? formatCellValue(pair.value2) : "";

  const ensure = (title: string) => {
    if (!sections[title]) {
      sections[title] = { fields: {} };
      sectionOrder.push(title);
    }
    return sections[title]!;
  };

  const sec = ensure(currentTitle);
  const fields = sec.fields;

  if (vHint !== "") {
    if (fields[rawKey] === undefined) fields[rawKey] = vMain;
    else if (vMain !== "") putField(fields, rawKey, vMain, "duplicate");
    fields[`${rawKey} (reference)`] = vHint;
  } else {
    const existing = fields[rawKey];
    if (existing === undefined) {
      fields[rawKey] = vMain;
    } else if (vMain !== "") {
      putField(fields, rawKey, vMain, "duplicate");
    }
  }

  return {
    rawKey,
    labelCol: pair.labelCol === 0 ? 0 : 1,
  };
}

function finalizeWorkbook(
  sections: Record<string, JobInfoSection>
): Record<string, JobInfoSection> {
  const out: Record<string, JobInfoSection> = {};
  for (const [k, sec] of Object.entries(sections)) {
    const copy: JobInfoSection = { fields: { ...sec.fields } };
    if (sec.tables && sec.tables.length > 0) copy.tables = [...sec.tables];
    out[k] = copy;
  }
  return out;
}

/**
 * Full intelligent parse: sections, tables, continuation lines, empty values preserved.
 */
export async function parseJobInfoWorkbook(file: File): Promise<JobInfoWorkbook> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellDates: true,
    raw: false,
  });
  const sheetName = workbook.SheetNames[0] ?? "";
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  const empty: JobInfoWorkbook = {
    sections: {},
    preamble: {},
    meta: { sheetName, sectionOrder: [] },
  };
  if (!sheet) return empty;

  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
    raw: false,
  });

  const sectionOrder: string[] = [];
  const sections: Record<string, JobInfoSection> = {};
  const preamble: Record<string, string | string[]> = {};

  let currentTitle: string | null = null;
  let lastRawKey: string | null = null;
  let lastLabelCol: 0 | 1 = 1;

  type TenderPhase = "seekingTable" | "inTable" | "afterTable";
  let tenderPhase: TenderPhase = "afterTable";
  let tenderHeaders: string[] = [];
  const tenderRows: Record<string, string>[] = [];
  let tenderBlankStreak = 0;

  const ensureSection = (title: string) => {
    if (!sections[title]) {
      sections[title] = { fields: {} };
      sectionOrder.push(title);
    }
    return sections[title]!;
  };

  const flushTenderTable = (title: string) => {
    if (tenderHeaders.length === 0 || tenderRows.length === 0) return;
    const sec = ensureSection(title);
    if (!sec.tables) sec.tables = [];
    sec.tables.push({
      name: "Bid comparison",
      headers: [...tenderHeaders],
      rows: tenderRows.map((r) => ({ ...r })),
    });
    tenderHeaders = [];
    tenderRows.length = 0;
    tenderBlankStreak = 0;
  };

  for (let ri = 0; ri < rows.length; ri++) {
    const row = rows[ri]!;
    if (!Array.isArray(row)) continue;

    if (isSectionHeaderRow(row)) {
      if (currentTitle === "Tender Summary" && tenderPhase === "inTable") {
        flushTenderTable("Tender Summary");
      }
      const headerText = rowPrimaryText(row);
      currentTitle = titleFromHeader(headerText);
      lastRawKey = null;
      tenderPhase =
        currentTitle === "Tender Summary" ? "seekingTable" : "afterTable";
      tenderHeaders = [];
      tenderRows.length = 0;
      tenderBlankStreak = 0;
      continue;
    }

    if (currentTitle === null) {
      const idx = firstNonEmptyColumn(row);
      if (idx >= 0) {
        const colLetter = String.fromCharCode(65 + Math.min(idx, 25));
        const key = `Column ${colLetter} (row ${ri + 1})`;
        const rest = row
          .slice(idx)
          .map((c) => formatCellValue(c))
          .filter((s) => s !== "")
          .join("\n");
        if (rest) putField(preamble, key, rest, "append");
      }
      continue;
    }

    if (currentTitle === "Contractor Invite") {
      const inv = parseContractorInviteRow(row);
      if (inv) {
        const sec = ensureSection(currentTitle);
        if (!sec.tables) sec.tables = [];
        let t = sec.tables.find((x) => x.name === "Invites");
        if (!t) {
          t = {
            name: "Invites",
            headers: ["Contractor Name", "Contractor Contact Name", "Email"],
            rows: [],
          };
          sec.tables.push(t);
        }
        t.rows.push(inv);
      }
      continue;
    }

    if (currentTitle === "Tender Summary") {
      const b = formatCellValue(row[1]);
      const c = formatCellValue(row[2]);

      if (tenderPhase === "seekingTable") {
        if (isTenderBidTableHeader(b, c)) {
          tenderHeaders = [b, c || "Total Stipulated Price (Excluding HST)"];
          tenderPhase = "inTable";
          tenderBlankStreak = 0;
          continue;
        }
      }

      if (tenderPhase === "inTable") {
        const pairFt = pickLabelValuePair(row);
        if (
          pairFt &&
          isTenderPostTableFieldLabel(rawLabelText(pairFt.label))
        ) {
          flushTenderTable("Tender Summary");
          tenderPhase = "afterTable";
          const { rawKey, labelCol } = applyKeyValueToSection(
            sections,
            sectionOrder,
            currentTitle,
            pairFt
          );
          lastRawKey = rawKey;
          lastLabelCol = labelCol;
          continue;
        }

        if (b === "" && c === "") {
          tenderBlankStreak++;
          if (tenderBlankStreak >= 2 && tenderRows.length > 0) {
            flushTenderTable("Tender Summary");
            tenderPhase = "afterTable";
          }
          continue;
        }

        tenderBlankStreak = 0;
        tenderRows.push({
          [tenderHeaders[0] ?? "Contractor Name"]: b,
          [tenderHeaders[1] ?? "Total Stipulated Price (Excluding HST)"]: c,
        });
        continue;
      }

      const pairEarly = pickLabelValuePair(row);
      if (tenderPhase === "seekingTable" && pairEarly) {
        const { rawKey, labelCol } = applyKeyValueToSection(
          sections,
          sectionOrder,
          currentTitle,
          pairEarly
        );
        lastRawKey = rawKey;
        lastLabelCol = labelCol;
        continue;
      }
    }

    const pair = pickLabelValuePair(row);
    if (pair) {
      const { rawKey, labelCol } = applyKeyValueToSection(
        sections,
        sectionOrder,
        currentTitle,
        pair
      );
      lastRawKey = rawKey;
      lastLabelCol = labelCol;
      continue;
    }

    if (lastRawKey && currentTitle) {
      const cont = continuationText(row, lastLabelCol);
      if (cont) {
        const sec = ensureSection(currentTitle);
        putField(sec.fields, lastRawKey, cont, "append");
      }
    }
  }

  if (currentTitle === "Tender Summary" && tenderPhase === "inTable") {
    flushTenderTable("Tender Summary");
  }

  return {
    sections: finalizeWorkbook(sections),
    preamble,
    meta: { sheetName, sectionOrder },
  };
}

/**
 * Nested JSON matching the template: each section is one object (field keys + optional `invites` / `bids` tables).
 * Section order follows the sheet.
 */
export function workbookToClientData(wb: JobInfoWorkbook): Record<string, unknown> {
  const ordered: Record<string, unknown> = {};
  if (Object.keys(wb.preamble).length > 0) {
    ordered.Preamble = wb.preamble;
  }
  for (const title of wb.meta.sectionOrder) {
    const sec = wb.sections[title];
    if (!sec) continue;
    const block: Record<string, unknown> = {};
    if (sec.tables?.length) {
      for (const tbl of sec.tables) {
        const tableKey =
          tbl.name === "Bid comparison"
            ? "bids"
            : tbl.name === "Invites"
              ? "invites"
              : tbl.name.replace(/\s+/g, "");
        block[tableKey] = { headers: tbl.headers, rows: tbl.rows };
      }
    }
    Object.assign(block, sec.fields);
    ordered[title] = block;
  }
  return ordered;
}

function flatFromWorkbook(w: JobInfoWorkbook): JobInfoSheetInput {
  const acc: JobInfoSheetInput = {};
  const visit = (fields: Record<string, string | string[]>) => {
    for (const [raw, val] of Object.entries(fields)) {
      const n = normalizeLabelKey(raw);
      const field = NORMALIZED_KEY_TO_FIELD[n as keyof typeof NORMALIZED_KEY_TO_FIELD];
      if (!field) continue;
      const s = Array.isArray(val) ? val.join(", ") : val;
      if (!s) continue;
      if (field === "siteLocation" && acc.siteLocation) {
        acc.siteLocation = `${acc.siteLocation}, ${s}`;
      } else {
        (acc as Record<string, string>)[field] = s;
      }
    }
  };
  for (const t of w.meta.sectionOrder) {
    visit(w.sections[t]?.fields ?? {});
  }
  return acc;
}

export function flattenJobInfoWorkbook(wb: JobInfoWorkbook): JobInfoSheet {
  return jobInfoSheetSchema.parse(flatFromWorkbook(wb));
}

export async function parseExcelJobSheet(file: File): Promise<JobInfoSheet> {
  const wb = await parseJobInfoWorkbook(file);
  return flattenJobInfoWorkbook(wb);
}

export type ExcelJobSheetParseDebug = {
  sheetNames: string[];
  sheetUsed: string | null;
  rowCount: number;
  rowPreview: unknown[][];
  extractedPairs: Array<{
    rowIndex: number;
    labelColumn: "A" | "B";
    rawLabel: string;
    normalizedKey: string;
    rawValue: string;
    mappedField: keyof JobInfoSheetInput | null;
  }>;
  unmatchedNormalizedKeys: string[];
};

export async function parseExcelJobSheetWithDebug(
  file: File
): Promise<{ data: JobInfoSheet; debug: ExcelJobSheetParseDebug }> {
  const wb = await parseJobInfoWorkbook(file);
  const data = flattenJobInfoWorkbook(wb);
  const debug: ExcelJobSheetParseDebug = {
    sheetNames: wb.meta.sheetName ? [wb.meta.sheetName] : [],
    sheetUsed: wb.meta.sheetName || null,
    rowCount: 0,
    rowPreview: [],
    extractedPairs: [],
    unmatchedNormalizedKeys: [],
  };
  return { data, debug };
}
