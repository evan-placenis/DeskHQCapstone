import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { Pool } from "pg";

// 1. Setup the connection pool using PostgreSQL connection string
const connectionString = process.env.DATABASE_URL

console.log('🔌 Checkpointer: Initializing...');
console.log('   DATABASE_URL:', process.env.DATABASE_URL ? '✅ Found' : '❌ Not set');
if (!connectionString) {
  console.error('❌ CRITICAL: No PostgreSQL connection string found!');
  console.error('   Add to .env.local: DATABASE_URL=postgresql://postgres...');
  console.error('   Get it from: Supabase Dashboard → Settings → Database → Connection string → URI');
} else if (connectionString.startsWith('https://') || connectionString.startsWith('http://')) {
  console.error('❌ CRITICAL: Connection string is HTTP URL, not PostgreSQL URL!');
  console.error('   Current:', connectionString);
  console.error('   You need the PostgreSQL connection string from Supabase Dashboard');
} else {
  console.log('   Using connection string: ✅ Valid PostgreSQL URL');
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
    console.log('✅ Checkpointer: PostgreSQL connection successful');
    client.release();
  })
  .catch((err) => {
    console.error('❌ Checkpointer: PostgreSQL connection failed:', err.message);
    console.error('   Make sure DATABASE_URL is set correctly');
  });


// 3. Create and Export the Saver DIRECTLY
// This preserves all class methods (list, get, put) automatically.
export const sharedCheckpointer = new PostgresSaver(pool);

// 4. (Optional) Initialize tables on startup
// Since you already created them in SQL, this is just a safeguard.
sharedCheckpointer.setup().catch((err) => {
  console.error("⚠️ Error verifying checkpoint tables:", err.message);
});
