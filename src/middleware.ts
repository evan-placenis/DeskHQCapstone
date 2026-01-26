import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {

  // 1. FAST EXIT: Don't run on prefetch or internal Next.js data requests
  if (
    request.headers.get('x-nextjs-data') ||
    request.headers.get('purpose') === 'prefetch'
  ) {
    return NextResponse.next()
  }

  console.log("Middleware running:", request.nextUrl.pathname)

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Check for keys, with typo fallback just in case
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABSE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // If keys are missing, we can't refresh session, just pass through
    return response
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value) // Update request for Server Components
            response.cookies.set(name, value, options) // Update response for Browser
          })
        },
      },
    }
  )

  // This will refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/server-side/nextjs
  const { data: { user } } = await supabase.auth.getUser()

  // Protected routes: redirect to login if no user
  // Add any other protected paths here
  const protectedPaths = ['/project', '/dashboard', '/report', '/settings', '/mystats', '/analytics_dashboard', '/audio_timeline', '/capture', '/organization_password', '/peer_review', '/reviewer', '/select-org']
  const isProtectedPath = protectedPaths.some(path => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath) {
    // Only pay the "latency tax" if we actually need to check the user
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/login'
      return NextResponse.redirect(redirectUrl)
    }
  }

  return response

}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
