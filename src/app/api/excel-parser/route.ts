import { NextResponse } from "next/server";
import { parseJobInfoWorkbook, workbookToClientData } from "@/lib/excel-parser";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

/**
 * POST /api/excel-parser
 * Parses Pretium Job Info Sheet uploads (.xls / .xlsx).
 * multipart/form-data with field name `file`.
 * Query `?debug=1` includes `workbookMeta` (sheet name + section order).
 */
export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const debug = url.searchParams.get("debug") === "1";

    const formData = await request.formData();
    const entry = formData.get("file");

    if (!entry || !(entry instanceof File)) {
      return NextResponse.json(
        { error: "Expected multipart field `file` with an Excel upload." },
        { status: 400 }
      );
    }

    const workbook = await parseJobInfoWorkbook(entry);
    const data = workbookToClientData(workbook);

    if (debug) {
      return NextResponse.json(
        { ok: true, data, workbookMeta: workbook.meta },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, data }, { status: 200 });
  } catch (err: unknown) {
    logger.error("excel-parser: Job info sheet parse failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse Excel" },
      { status: 500 }
    );
  }
}
