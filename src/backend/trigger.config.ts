import { defineConfig } from "@trigger.dev/sdk/v3";
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Robustly find .env file
// We assume the command is run from 'capstone/src/backend' or 'capstone'
// We look for the .env in the 'capstone' root.

const findEnvFile = () => {
  // 1. Try relative to __dirname (original approach, good for source)
  let attempt = path.resolve(__dirname, '../../.env');
  if (fs.existsSync(attempt)) return attempt;

  // 2. Try relative to process.cwd() (good for when running the CLI)
  // If cwd is capstone/src/backend -> ../../.env
  attempt = path.resolve(process.cwd(), '../../.env');
  if (fs.existsSync(attempt)) return attempt;
  
  // 3. Try relative to process.cwd() assuming cwd is root
  attempt = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(attempt)) return attempt;

  return null;
}

const envPath = findEnvFile();

if (envPath) {
  console.log(`🔍 Loading .env from: ${envPath}`);
  const result = dotenv.config({ path: envPath });
  if (result.error) {
    console.error(`❌ Error parsing .env file:`, result.error);
  } else {
    // Verify key variable
    const hasKey = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
    console.log(`✅ Loaded .env. SUPABASE_URL present: ${hasKey}`);
  }
} else {
  console.warn(`⚠️ .env file NOT found. Checked common locations relative to ${__dirname} and ${process.cwd()}`);
}

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
