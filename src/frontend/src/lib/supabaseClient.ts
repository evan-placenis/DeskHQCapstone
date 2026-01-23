// 🟢 CHANGE THIS IMPORT
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const globalForSupabase = global as unknown as { supabase: any }

if (!supabaseUrl || !supabaseAnonKey) {
    console.error("⚠️ Missing Supabase environment variables.");
}

// 🟢 USE createBrowserClient HERE
export const supabase = globalForSupabase.supabase || createBrowserClient(supabaseUrl, supabaseAnonKey)

if (process.env.NODE_ENV !== 'production') {
    globalForSupabase.supabase = supabase
}