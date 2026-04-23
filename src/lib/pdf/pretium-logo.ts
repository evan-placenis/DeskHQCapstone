import fs from "fs";
import path from "path";

/** PNG under public/brand/pretium-logo.png (committed in repo). */
export function loadPretiumLogoDataUrl(): string | undefined {
  try {
    const p = path.join(process.cwd(), "public", "brand", "pretium-logo.png");
    if (!fs.existsSync(p)) return undefined;
    const b = fs.readFileSync(p);
    return `data:image/png;base64,${b.toString("base64")}`;
  } catch {
    return undefined;
  }
}
