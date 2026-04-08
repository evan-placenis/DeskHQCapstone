import { NextResponse } from "next/server";
import {
  flattenJobInfoWorkbook,
  parseJobInfoWorkbook,
  workbookToClientData,
} from "@/lib/excel-parser";
import { ZodError } from "zod";

export const runtime = "nodejs";

/**
 * POST /api/test-excel
 * multipart/form-data with field name `file` (Job Info Sheet .xls / .xlsx).
 * Add query `?debug=1` to include `workbookMeta` (sheet name + section order) in the JSON.
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
    const flat = flattenJobInfoWorkbook(workbook);

    console.log(
      "[test-excel] Workbook (by section):\n",
      JSON.stringify(data, null, 2)
    );
    console.log(
      "[test-excel] Flat DB-oriented fields:\n",
      JSON.stringify(flat, null, 2)
    );

    if (debug) {
      return NextResponse.json(
        { ok: true, data, flat, workbookMeta: workbook.meta },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, data, flat }, { status: 200 });
  } catch (err) {
    if (err instanceof ZodError) {
      console.error("[test-excel] Zod validation error:", err.flatten());
      return NextResponse.json(
        { error: "Validation failed", details: err.flatten() },
        { status: 422 }
      );
    }
    console.error("[test-excel] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse Excel" },
      { status: 500 }
    );
  }
}
