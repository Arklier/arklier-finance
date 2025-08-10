import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { secureLogger } from '@/lib/utils/secure-logger'

export async function middleware(request: NextRequest) {
  const startTime = Date.now()
  let supabaseResponse = NextResponse.next({
    request,
  })

  // Add security headers
  supabaseResponse.headers.set('X-Content-Type-Options', 'nosniff')
  supabaseResponse.headers.set('X-Frame-Options', 'DENY')
  supabaseResponse.headers.set('X-XSS-Protection', '1; mode=block')
  supabaseResponse.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  supabaseResponse.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  
  // Add Content Security Policy - allow localhost for development
  const isLocalhost = request.nextUrl.hostname === 'localhost' || request.nextUrl.hostname === '127.0.0.1'
  const connectSrc = isLocalhost
    ? "'self' https: wss: ws: http://localhost:* http://127.0.0.1:*"
    : "'self' https: wss: ws:"
  
  supabaseResponse.headers.set(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src ${connectSrc}; frame-ancestors 'none';`
  )

  try {
    // Check if this is a protected route
    const protectedRoutes = ['/dashboard', '/api/exchanges', '/api/security']
    const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route))
    
    if (!isProtectedRoute) {
      // Not a protected route, allow access
      const duration = Date.now() - startTime
      secureLogger.info('Middleware: Non-protected route accessed', {
        path: request.nextUrl.pathname,
        duration: `${duration}ms`
      })
      return supabaseResponse
    }

    // Create Supabase client for authentication check
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            supabaseResponse.cookies.set({ name, value, ...options })
          },
          remove(name: string, options: any) {
            supabaseResponse.cookies.set({ name, value: '', ...options })
          },
        },
      }
    )

    // Check authentication using getSession
    const { data: { session }, error } = await supabase.auth.getSession()

    if (error) {
      secureLogger.warn('Middleware auth error:', { error: error.message, path: request.nextUrl.pathname })
    }

    if (!session) {
      secureLogger.info('Redirecting unauthenticated user to login', { 
        path: request.nextUrl.pathname
      })
      return NextResponse.redirect(new URL('/auth/login', request.url))
    }

    // Log successful middleware execution
    const duration = Date.now() - startTime
    secureLogger.info('Middleware executed successfully', {
      path: request.nextUrl.pathname,
      user: session.user?.email || 'unknown',
      duration: `${duration}ms`
    })

    return supabaseResponse

  } catch (error) {
    secureLogger.error('Middleware error:', { 
      error: error instanceof Error ? error.message : 'Unknown error',
      path: request.nextUrl.pathname 
    })
    
    // On error, redirect to login for safety
    return NextResponse.redirect(new URL('/auth/login', request.url))
  }
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
}
