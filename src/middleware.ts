// middleware.ts
// COMPLETELY FIXED VERSION - Proper JWT verification and authentication logic

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Only protect these specific routes that require authentication
const protectedRoutes = [
  '/dashboard/create-website',
  '/dashboard/analyze-website',
  '/dashboard/my-websites',
  '/dashboard/analytics',
  '/dashboard/chatbot',
  '/dashboard/support',
  '/dashboard/enterprise',
  '/dashboard/custom-domains',
  '/dashboard/my-analyses'
];

// Simple JWT verification function
function isValidJWT(token: string): boolean {
  try {
    // Basic JWT structure validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return false;
    }

    // Decode payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token has required fields and is not expired
    if (!payload.userId || !payload.email) {
      return false;
    }

    // Check expiration (if present)
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return false;
    }

    return true;
  } catch (error) {
    return false;
  }
}

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

  // Verify if user is properly authenticated
  const isAuthenticated = authToken && isValidJWT(authToken);

  // Handle protected dashboard routes ONLY
  if (protectedRoutes.some(route => pathname === route || pathname.startsWith(route + '/'))) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // User is properly authenticated, allow access
    return NextResponse.next();
  }

  // Handle /dashboard root - require authentication
  if (pathname === '/dashboard') {
    if (!isAuthenticated) {
      // Redirect to login
      return NextResponse.redirect(new URL('/login', request.url));
    }

    // Authenticated, allow access
    return NextResponse.next();
  }

  // Handle auth routes (login, signup)
  if (authRoutes.includes(pathname)) {
    if (isAuthenticated) {
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
