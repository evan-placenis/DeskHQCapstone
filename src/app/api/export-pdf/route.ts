import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from "@/app/api/utils";
import { logger } from "@/lib/logger";
import { launchPdfBrowser } from "@/lib/pdf/launch-chromium";
import {
  buildPdfFooterTemplate,
  buildReportPdfDocumentHtml,
} from "@/lib/pdf/report-pdf-html";
import { buildPretiumPdfHeaderTemplate } from "@/lib/pdf/report-pdf-header";
import { loadPretiumLogoDataUrl } from "@/lib/pdf/pretium-logo";
import { templateIdToReportTypeLabel } from "@/lib/pdf/report-pdf-template-label";

export const runtime = "nodejs";

/** Vercel Pro+ can raise; Hobby max is 10s — PDF may need an upgrade for large docs */
export const maxDuration = 60;

const bodySchema = z.object({
  reportId: z.string().uuid(),
  tiptapHtml: z.string(),
  projectData: z.object({
    projectName: z.string().min(1, "projectName is required"),
    logoUrl: z.string().url().optional(),
  }),
});

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;

  try {
    const { user, supabase } = await createAuthenticatedClient();
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

    const { reportId, tiptapHtml, projectData } = parsed.data;

    const { data: reportRow, error: reportErr } = await supabase
      .from("reports")
      .select("id, project_id, template_id, job_info_sheet")
      .eq("id", reportId)
      .maybeSingle();

    if (reportErr || !reportRow) {
      return NextResponse.json(
        { error: "Report not found" },
        { status: 404 }
      );
    }

    const { data: orderedReports, error: ordErr } = await supabase
      .from("reports")
      .select("id")
      .eq("project_id", reportRow.project_id)
      .order("created_at", { ascending: true });

    if (ordErr || !orderedReports?.length) {
      logger.error("export-pdf: failed to list reports for project", ordErr);
      return NextResponse.json(
        { error: "Could not resolve report order" },
        { status: 500 }
      );
    }

    const idx = orderedReports.findIndex((r) => r.id === reportId);
    const reportNumber = idx >= 0 ? idx + 1 : 1;

    const jobInfoSheet =
      reportRow.job_info_sheet &&
      typeof reportRow.job_info_sheet === "object" &&
      !Array.isArray(reportRow.job_info_sheet)
        ? (reportRow.job_info_sheet as Record<string, unknown>)
        : null;

    const logoHttpUrl =
      projectData.logoUrl && projectData.logoUrl.length > 0
        ? projectData.logoUrl
        : undefined;
    const logoDataUrl = logoHttpUrl ? undefined : loadPretiumLogoDataUrl();

    const headerTemplate = buildPretiumPdfHeaderTemplate({
      jobInfoSheet,
      reportTypeLabel: templateIdToReportTypeLabel(reportRow.template_id),
      reportNumber,
      logoHttpUrl,
      logoDataUrl,
    });

    browser = await launchPdfBrowser();
    const page = await browser.newPage();

    const html = buildReportPdfDocumentHtml(tiptapHtml);
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45_000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate,
      footerTemplate: buildPdfFooterTemplate(),
      margin: {
        top: "260px",
        bottom: "36px",
        left: "48px",
        right: "48px",
      },
    });

    await browser.close();
    browser = null;

    const filename = `${projectData.projectName.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "_") || "Report"}_Report.pdf`;

    return new NextResponse(Buffer.from(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err: unknown) {
    if (browser) {
      try {
        await browser.close();
      } catch {
        /* ignore */
      }
    }
    logger.error("export-pdf failed:", err);
    const message = err instanceof Error ? err.message : "PDF generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
