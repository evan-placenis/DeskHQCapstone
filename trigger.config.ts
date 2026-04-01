import { defineConfig } from "@trigger.dev/sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { additionalFiles } from "@trigger.dev/build/extensions/core"; // 1. Import this

let envPath: string;
try {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  envPath = path.resolve(__dirname, ".env");
} catch {
  envPath = path.resolve(process.cwd(), ".env");
}

dotenv.config({ path: envPath });

export default defineConfig({
  project: "proj_ayfhjrhjwghurkiagzvh",
  runtime: "node",
  logLevel: "log",
  maxDuration: 3600,
  retries: {
    enabledInDev: true,
    default: {
      maxAttempts: 3,
      minTimeoutInMs: 1000,
      maxTimeoutInMs: 10000,
      factor: 2,
      randomize: true,
    },
  },
  dirs: ["./src/features/reports/services/trigger"],
  // 2. Add the build extension to grab your markdown files
  build: {
    extensions: [
      additionalFiles({
        files: ["./skills/**/*.md"], // This tells Trigger to upload all .md files in the skills folder
      }),
    ],
  },
});
