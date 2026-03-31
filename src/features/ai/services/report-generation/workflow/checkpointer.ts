import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";
import { logger } from "@/lib/logger";

// 1. Setup the connection pool using PostgreSQL connection string
const connectionString = process.env.DATABASE_SESSION_URL

logger.info('🔌 Checkpointer: Initializing...');
logger.info('   DATABASE_SESSION_URL:', process.env.DATABASE_SESSION_URL ? '✅ Found' : '❌ Not set');
if (!connectionString) {
  logger.error('❌ CRITICAL: No PostgreSQL connection string found!');
  logger.error('   Add to .env.local: DATABASE_URL=postgresql://postgres...');
  logger.error('   Get it from: Supabase Dashboard → Settings → Database → Connection string → URI');
} else if (connectionString.startsWith('https://') || connectionString.startsWith('http://')) {
  logger.error('❌ CRITICAL: Connection string is HTTP URL, not PostgreSQL URL!');
  logger.error('   Current:', connectionString);
  logger.error('   You need the PostgreSQL connection string from Supabase Dashboard');
} else {
  logger.info('   Using connection string: ✅ Valid PostgreSQL URL');
}

const pool = new Pool({
  connectionString: connectionString,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
});

// Test connection
pool.connect()
  .then((client) => {
    logger.info('✅ Checkpointer: PostgreSQL connection successful');
    client.release();
  })
  .catch((err) => {
    logger.error('❌ Checkpointer: PostgreSQL connection failed:', err.message);
    logger.error('   Make sure DATABASE_URL is set correctly');
  });


// 3. Create and Export the Saver DIRECTLY
// This preserves all class methods (list, get, put) automatically.
export const sharedCheckpointer = new PostgresSaver(pool);

// 4. (Optional) Initialize tables on startup
// Since you already created them in SQL, this is just a safeguard.
sharedCheckpointer.setup().catch((err) => {
  logger.error("⚠️ Error verifying checkpoint tables:", err.message);
});
