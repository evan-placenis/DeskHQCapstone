import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

// Check for variables, allowing for the NEXT_PUBLIC_ prefix if the user renamed them (though not recommended for Service Role Key)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
    throw new Error("Missing SUPABASE_URL in .env");
}

// Fallback to Anon Key if Service Role Key is missing (allows app to start for RLS-only flows)
const effectiveKey = anonKey;

if (!effectiveKey) {
    throw new Error("Missing both SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY in .env");
}

// 🛡️ ADMIN CLIENT
// This client has the 'Service Role' key, so it bypasses RLS.
// Use this ONLY in your backend to do admin tasks (like checking user auth).
// export const supabaseAdmin = createClient(
//    supabaseUrl,
//    effectiveKey,
//    {
//        auth: {
//            autoRefreshToken: false,
//            persistSession: false
//        }
//    }
// );