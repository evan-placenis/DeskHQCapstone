
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export class Container {
    // Private holder for the client
    private static _supabase: SupabaseClient;

    // ✅ THE FIX: Use a 'getter'. 
    // This code only runs when you type 'Container.supabase'
    static get supabase() {
        if (!this._supabase) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            
            // ⚠️ CRITICAL: For background jobs (Trigger.dev), you MUST use the Service Role Key.
            // The Anon key will block your backend from reading user data.
            const effectiveKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            if (!supabaseUrl || !effectiveKey) {
                throw new Error("Missing Supabase URL or Key in environment variables.");
            }

            this._supabase = createClient(supabaseUrl, effectiveKey);
        }
        return this._supabase;
    }

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