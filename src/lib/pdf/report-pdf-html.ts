/** Escape text for safe insertion into HTML attribute / template text nodes */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type ProjectPdfMeta = {
  projectName: string;
  /** Optional absolute https URL for header logo */
  logoUrl?: string;
};

const TYPOGRAPHY_CSS = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.65;
    color: #0f172a;
    background: #fff;
  }
  .report-prose {
    max-width: 100%;
  }
  .report-prose h1 { font-size: 1.75rem; font-weight: 700; margin: 1.25em 0 0.5em; line-height: 1.2; }
  .report-prose h2 { font-size: 1.35rem; font-weight: 600; margin: 1.1em 0 0.45em; line-height: 1.25; }
  .report-prose h3 { font-size: 1.12rem; font-weight: 600; margin: 1em 0 0.4em; }
  .report-prose p { margin: 0.65em 0; }
  .report-prose ul, .report-prose ol { margin: 0.65em 0; padding-left: 1.35em; }
  .report-prose li { margin: 0.25em 0; }
  .report-prose blockquote {
    margin: 0.85em 0;
    padding-left: 1em;
    border-left: 3px solid #cbd5e1;
    color: #475569;
  }
  .report-prose table { border-collapse: collapse; width: 100%; margin: 1em 0; font-size: 10pt; }
  .report-prose th, .report-prose td { border: 1px solid #cbd5e1; padding: 0.45em 0.6em; text-align: left; vertical-align: top; }
  .report-prose th { background: #f1f5f9; font-weight: 600; }
  .report-prose img { max-width: 100%; height: auto; display: block; margin: 0.75em 0; }
  .report-prose pre, .report-prose code { font-family: ui-monospace, monospace; font-size: 0.92em; }
  .report-prose pre { background: #f8fafc; padding: 0.75em 1em; border-radius: 6px; overflow-x: auto; }
  .report-prose a { color: #2563eb; text-decoration: underline; }
  .report-prose hr { border: none; border-top: 1px solid #e2e8f0; margin: 1.5em 0; }
`;

/** Full HTML document for Puppeteer (body only gets user content; header/footer are separate templates). */
export function buildReportPdfDocumentHtml(tiptapHtml: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>${TYPOGRAPHY_CSS}</style>
</head>
<body>
  <main class="report-prose">${tiptapHtml}</main>
</body>
</html>`;
}

export function buildPdfHeaderTemplate(meta: ProjectPdfMeta): string {
  const name = escapeHtml(meta.projectName.trim() || "Project");
  const logo =
    meta.logoUrl &&
    (meta.logoUrl.startsWith("https://") || meta.logoUrl.startsWith("http://"))
      ? `<img src="${escapeHtml(meta.logoUrl)}" alt="" style="max-height:36px;max-width:140px;object-fit:contain;" />`
      : `<span style="font-size:11px;font-weight:700;color:#0f172a;letter-spacing:0.02em;">PRETIUM</span>`;

  return `
<div style="width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:8px 56px 10px;font-size:10px;border-bottom:1px solid #e2e8f0;display:flex;align-items:center;justify-content:space-between;box-sizing:border-box;">
  <div style="display:flex;align-items:center;gap:14px;min-width:0;">
    ${logo}
    <span style="font-weight:600;color:#0f172a;font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${name}</span>
  </div>
</div>`;
}

export function buildPdfFooterTemplate(): string {
  return `
<div style="width:100%;-webkit-print-color-adjust:exact;print-color-adjust:exact;padding:6px 56px 0;font-size:9px;color:#64748b;text-align:center;box-sizing:border-box;">
  Page <span class="pageNumber"></span> of <span class="totalPages"></span>
</div>`;
}
