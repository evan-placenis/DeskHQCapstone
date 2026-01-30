// debug-images.ts
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// 1. Fix the Path to find .env at the project root
// We have to walk up 4 levels: test_scripts -> src -> backend -> src -> capstone
const __filename = fileURLToPath(new URL(import.meta.url));
const __dirname = path.dirname(__filename);
const envPath = path.resolve(__dirname, '../../../../.env');

// Load the env file explicitly
dotenv.config({ path: envPath });

console.log(`\n🔍 Loading .env from: ${envPath}`);

// 2. Import Container AFTER loading env vars
// We use dynamic import to ensure Container loads AFTER variables are set
async function runDebug() {
  const { Container } = await import('../config/container');

  const TARGET_PROJECT_ID = 'abaf92bc-0adc-46df-8ad7-61921aa97606'; 

  console.log(`--- QUERYING PROJECT: ${TARGET_PROJECT_ID} ---`);

  try {
      // Test 1: Count Images directly
      const { count, error } = await Container.adminClient
        .from('project_images')
        .select('*', { count: 'exact', head: true })
        .eq('project_id', TARGET_PROJECT_ID);

      if (error) {
        console.error("❌ DB Query Failed:", error.message);
      } else {
        console.log(`📸 Image Count (Admin Client): ${count}`);
      }

      // Test 2: Global Count
      const { count: totalCount } = await Container.adminClient
        .from('project_images')
        .select('*', { count: 'exact', head: true });
        
      console.log(`📊 Total Images in Table: ${totalCount}`);

  } catch (err) {
      console.error("❌ CRITICAL ERROR:", (err as Error).message);
      console.error("👉 Check your .env file for SUPABASE_SERVICE_ROLE_KEY");
  }
}

runDebug();