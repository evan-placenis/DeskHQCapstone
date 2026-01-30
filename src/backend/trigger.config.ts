import { defineConfig } from "@trigger.dev/sdk";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load environment variables from .env file
// Find .env file relative to the project root (capstone folder)
let envPath: string;
try {
  // Try ES module approach first
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  envPath = path.resolve(__dirname, "../../.env");
} catch {
  // Fallback to CommonJS approach
  envPath = path.resolve(process.cwd(), ".env");
}

dotenv.config({ path: envPath });


export default defineConfig({
  project: "proj_ayfhjrhjwghurkiagzvh",
  runtime: "node",
  logLevel: "log",
  // The max compute seconds a task is allowed to run. If the task run exceeds this duration, it will be stopped.
  // You can override this on an individual task.
  // See https://trigger.dev/docs/runs/max-duration
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
  dirs: ["./src/infrastructure/job/trigger"],
});
