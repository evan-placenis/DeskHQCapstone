import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { logger } from "@/lib/logger";

let pool: Pool | null = null;
let saver: PostgresSaver | null = null;

/**
 * Lazy Postgres checkpointer for LangGraph. Do not instantiate at module load:
 * many API routes import `Container` → `ReportOrchestrator` → `workflow/index`, and
 * eager init would connect to Postgres for unrelated requests.
 */
export function getSharedCheckpointer(): PostgresSaver {
  if (saver) return saver;

  const connectionString = process.env.DATABASE_SESSION_URL;

  logger.info("🔌 Checkpointer: lazy init (first LangGraph workflow use)…");
  logger.info("   DATABASE_SESSION_URL:", process.env.DATABASE_SESSION_URL ? "✅ Found" : "❌ Not set");

  if (!connectionString) {
    logger.error("❌ CRITICAL: No PostgreSQL connection string found!");
    logger.error("   Add to .env.local: DATABASE_SESSION_URL=postgresql://postgres...");
    throw new Error("DATABASE_SESSION_URL is not set (required for LangGraph checkpointing)");
  }
  if (connectionString.startsWith("https://") || connectionString.startsWith("http://")) {
    logger.error("❌ CRITICAL: Connection string is HTTP URL, not PostgreSQL URL!");
    throw new Error("DATABASE_SESSION_URL must be a PostgreSQL URI, not an HTTP URL");
  }

  logger.info("   Using connection string: ✅ Valid PostgreSQL URL");

  pool = new Pool({
    connectionString,
    ssl: {
      rejectUnauthorized: false,
    },
  });

  pool
    .connect()
    .then((client) => {
      logger.info("✅ Checkpointer: PostgreSQL connection successful");
      client.release();
    })
    .catch((err: Error) => {
      logger.error("❌ Checkpointer: PostgreSQL connection failed:", err.message);
    });

  saver = new PostgresSaver(pool);
  saver.setup().catch((err: Error) => {
    logger.error("⚠️ Error verifying checkpoint tables:", err.message);
  });

  return saver;
}
