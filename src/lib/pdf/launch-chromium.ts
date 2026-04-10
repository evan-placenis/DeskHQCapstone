import type { Browser } from "puppeteer-core";

/**
 * Launch Chromium for PDF generation.
 * - On Vercel / Lambda: @sparticuz/chromium (fits serverless size limits).
 * - Locally: system Chrome via CHROME_EXECUTABLE_PATH or default OS paths.
 */
export async function launchPdfBrowser(): Promise<Browser> {
  const puppeteer = await import("puppeteer-core");

  const isServerless =
    process.env.VERCEL === "1" || !!process.env.AWS_LAMBDA_FUNCTION_VERSION;

  if (isServerless) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return puppeteer.default.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    });
  }

  const chromePath =
    process.env.CHROME_EXECUTABLE_PATH ||
    process.env.PUPPETEER_EXECUTABLE_PATH ||
    (process.platform === "win32"
      ? "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"
      : process.platform === "darwin"
        ? "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
        : "/usr/bin/google-chrome");

  return puppeteer.default.launch({
    executablePath: chromePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}
