import { NextResponse } from "next/server";
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Container } from '@/backend/config/container';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password" }, { status: 400 });
    }

    // 1. Setup Supabase Client (Handles Cookies & Keys automatically)
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // API Route might ignore this, but it prepares the response headers
            }
          },
        },
      }
    );

    // 2. Perform Login (This automatically sets the Auth Cookie!)
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
       console.error("Supabase Login Failed:", error.message);
       return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // 3. OPTIONAL: Fetch Profile via Service (if you need extra data)
    // We pass the authenticated 'supabase' client to the service
    let userProfile = null;
    if (data.session?.user) {
        try {
            userProfile = await Container.userService.getUserProfile(
                data.session.user.id, 
                supabase // Pass the client that just logged in
            );
        } catch (profileError) {
            console.warn("Could not fetch user profile:", profileError);
            // Don't fail login just because profile fetch failed
        }
    }

    // 4. Return Success
    // The browser now has the cookie and is officially logged in.
    return NextResponse.json({ 
        success: true, 
        user: data.user,
        profile: userProfile 
    }, { status: 200 });

  } catch (error: any) {
    console.error("❌ Login Route Error:", error);
    return NextResponse.json(
      { error: error.message || "Login failed" },
      { status: 500 }
    );
  }
}