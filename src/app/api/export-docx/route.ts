import { NextResponse } from "next/server";
import { z } from "zod";
import HTMLtoDOCX from "html-to-docx";
import { createAuthenticatedClient } from "@/app/api/utils";
import { logger } from "@/lib/logger";
import { normalizeLabelKey } from "@/lib/excel-parser";

export const runtime = "nodejs";

export const maxDuration = 60;

const projectDataSchema = z.object({
  projectName: z.string().min(1, "projectName is required"),
  client: z.string().optional(),
  projectManager: z.string().optional(),
  date: z.string().optional(),
});

const bodySchema = z.object({
  tiptapHtml: z.string(),
  projectData: projectDataSchema,
  /** Optional workbook JSON (same shape as stored job_info_sheet) to fill missing header fields */
  jobInfoSheet: z.record(z.string(), z.unknown()).optional(),
});

function escapeHeaderText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function collectFromJobSheet(sheet: Record<string, unknown>): Map<string, string> {
  const map = new Map<string, string>();
  for (const secVal of Object.values(sheet)) {
    if (!secVal || typeof secVal !== "object" || Array.isArray(secVal)) continue;
    const block = secVal as Record<string, unknown>;
    for (const [rawLabel, val] of Object.entries(block)) {
      if (
        val &&
        typeof val === "object" &&
        !Array.isArray(val) &&
        "headers" in (val as object) &&
        "rows" in (val as object)
      ) {
        continue;
      }
      const nk = normalizeLabelKey(rawLabel);
      const str = Array.isArray(val)
        ? val.map((x) => String(x).trim()).filter(Boolean).join(", ")
        : String(val ?? "").trim();
      if (nk && str) map.set(nk, str);
    }
  }
  return map;
}

function enrichFromJobSheet(
  pd: z.infer<typeof projectDataSchema>,
  jobInfoSheet: Record<string, unknown> | undefined
): z.infer<typeof projectDataSchema> {
  if (!jobInfoSheet) return pd;
  const m = collectFromJobSheet(jobInfoSheet);
  return {
    projectName: pd.projectName,
    client:
      pd.client?.trim() ||
      m.get(normalizeLabelKey("Client")) ||
      m.get(normalizeLabelKey("Client Company Name")) ||
      "",
    projectManager:
      pd.projectManager?.trim() ||
      m.get(normalizeLabelKey("Project Manager")) ||
      m.get(normalizeLabelKey("Name")) ||
      "",
    date:
      pd.date?.trim() ||
      m.get(normalizeLabelKey("Date of Visit")) ||
      m.get(normalizeLabelKey("Visit Date")) ||
      "",
  };
}

function buildHeaderHtml(pd: z.infer<typeof projectDataSchema>): string {
  const name = escapeHeaderText(pd.projectName.trim() || "Report");
  const pm = escapeHeaderText((pd.projectManager ?? "").trim() || "—");
  const date = escapeHeaderText(
    (pd.date ?? "").trim() || new Date().toLocaleDateString()
  );
  const client = (pd.client ?? "").trim();
  const clientPart = client ? ` | Client: ${escapeHeaderText(client)}` : "";
  const line = `Project: ${name}${clientPart} | Prepared by: ${pm} | Date: ${date}`;
  return `<p style="font-size:10pt;font-family:Arial,sans-serif;margin:0;">${line}</p>`;
}

export async function POST(request: Request) {
  try {
    const { user } = await createAuthenticatedClient();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { tiptapHtml, projectData, jobInfoSheet } = parsed.data;
    const merged = enrichFromJobSheet(
      projectData,
      jobInfoSheet &&
        typeof jobInfoSheet === "object" &&
        !Array.isArray(jobInfoSheet)
        ? (jobInfoSheet as Record<string, unknown>)
        : undefined
    );

    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /></head><body>${tiptapHtml}</body></html>`;

    const headerHtml = buildHeaderHtml(merged);
    const footerHtml = `<p style="font-size:9pt;font-family:Arial,sans-serif;text-align:center;margin:0;color:#64748b;">DeskHQ</p>`;

    const documentOptions = {
      orientation: "portrait" as const,
      margins: {
        top: 1440,
        right: 1440,
        bottom: 1440,
        left: 1440,
        header: 720,
        footer: 720,
        gutter: 0,
      },
      title: `${merged.projectName} — Report`,
      header: true,
      footer: true,
      pageNumber: true,
      font: "Arial",
      fontSize: 24,
    };

    const out = await HTMLtoDOCX(fullHtml, headerHtml, documentOptions, footerHtml);

    const buffer = Buffer.isBuffer(out)
      ? out
      : Buffer.from(await (out as Blob).arrayBuffer());

    const safeBase =
      merged.projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Report";

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${safeBase}_Report.docx"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    logger.error("export-docx failed:", err);
    const message = err instanceof Error ? err.message : "DOCX export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
