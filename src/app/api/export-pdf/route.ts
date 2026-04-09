import { NextResponse } from "next/server";
import { z } from "zod";
import { createAuthenticatedClient } from "@/app/api/utils";
import { logger } from "@/lib/logger";
import { launchPdfBrowser } from "@/lib/pdf/launch-chromium";
import {
  buildPdfFooterTemplate,
  buildPdfHeaderTemplate,
  buildReportPdfDocumentHtml,
} from "@/lib/pdf/report-pdf-html";

export const runtime = "nodejs";

/** Vercel Pro+ can raise; Hobby max is 10s — PDF may need an upgrade for large docs */
export const maxDuration = 60;

const bodySchema = z.object({
  tiptapHtml: z.string(),
  projectData: z.object({
    projectName: z.string().min(1, "projectName is required"),
    logoUrl: z.string().url().optional(),
  }),
});

export async function POST(request: Request) {
  let browser: Awaited<ReturnType<typeof launchPdfBrowser>> | null = null;

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

    const { tiptapHtml, projectData } = parsed.data;
    const logoUrl =
      projectData.logoUrl && projectData.logoUrl.length > 0
        ? projectData.logoUrl
        : undefined;

    browser = await launchPdfBrowser();
    const page = await browser.newPage();

    const html = buildReportPdfDocumentHtml(tiptapHtml);
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 45_000 });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: buildPdfHeaderTemplate({
        projectName: projectData.projectName,
        logoUrl,
      }),
      footerTemplate: buildPdfFooterTemplate(),
      margin: {
        top: "88px",
        bottom: "56px",
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
