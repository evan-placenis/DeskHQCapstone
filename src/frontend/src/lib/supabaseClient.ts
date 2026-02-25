// 🟢 CHANGE THIS IMPORT
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const globalForSupabase = global as unknown as { supabase: any }

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("⚠️ Missing Supabase environment variables.");
}

// 🟢 USE createBrowserClient HERE
// Realtime: longer timeout so channel subscribe doesn't TIMED_OUT (default 10s can be too short)
export const supabase = globalForSupabase.supabase || createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: { timeout: 20_000 },
})

if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabase = supabase
}