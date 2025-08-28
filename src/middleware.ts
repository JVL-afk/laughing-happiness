// middleware.ts
// PROPERLY FIXED VERSION - Correct authentication logic

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only protect these specific routes
const protectedRoutes = [
  '/dashboard/create-website',
  '/dashboard/analyze-website',
  '/dashboard/my-websites',
  '/dashboard/analytics',
  '/dashboard/chatbot',
  '/dashboard/support',
  '/dashboard/enterprise',
  '/dashboard/costum-domains',
  '/dashboard/my-analyses'
];

// Routes that should redirect to dashboard if already logged in
const authRoutes = [
  '/login',
  '/signup'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.') ||
    pathname.startsWith('/public/')
  ) {
    return NextResponse.next();
  }

  // Get the token from cookies (check all possible cookie names)
  const authToken = request.cookies.get('auth-token')?.value ||
                   request.cookies.get('token')?.value ||
                   request.cookies.get('authToken')?.value ||
                   request.cookies.get('jwt')?.value;

  // Simple check if user has any auth token (don't verify here, let API handle it)
  const hasAuthToken = !!authToken && authToken.length > 10;

  // Handle protected dashboard routes ONLY
  if (protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    if (!hasAuthToken) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // Has token, let the API routes verify it properly
    return NextResponse.next();
  }

  // Handle /dashboard root - allow both authenticated and unauthenticated
  if (pathname === '/dashboard') {
    if (!hasAuthToken) {
      // Redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }
    
    // Has token, allow access
    return NextResponse.next();
  }

  // Handle auth routes (login, signup)
  if (authRoutes.includes(pathname)) {
    if (hasAuthToken) {
      // Already logged in, redirect to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Not logged in, allow access to auth pages
    return NextResponse.next();
  }

  // For ALL OTHER routes (including homepage), allow access regardless of auth status
  // This fixes the homepage redirect issue
  return NextResponse.next();
}

// Configure which paths the middleware should run on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!api|_next/static|_next/image|favicon.ico|public).*)',
  ],
};
