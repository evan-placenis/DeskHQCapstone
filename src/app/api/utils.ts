import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { User } from '@supabase/supabase-js';

/**
 * Helper to get a configured Supabase client for API routes
 * @returns {Promise<{ supabase: SupabaseClient, user: User | null }>}
 */
export async function createAuthenticatedClient() {
    const cookieStore = await cookies();
    
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                getAll() {
                    return cookieStore.getAll();
                },
                setAll(cookiesToSet) {
                    try {
                        cookiesToSet.forEach(({ name, value, options }) =>
                            cookieStore.set(name, value, options)
                        );
                    } catch {
                        // API routes might not be able to set cookies if headers are already sent
                    }
                },
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();

    return { supabase, user };
}

