// middleware.ts
// COMPLETE FIXED VERSION - Proper authentication routing for all dashboard pages

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

// Define protected routes that require authentication
const protectedRoutes = [
  '/dashboard',
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

// Define public routes that should redirect authenticated users
const publicRoutes = [
  '/login',
  '/signup',
  '/forgot-password',
  '/reset-password'
];

// API routes that don't need middleware processing
const apiRoutes = [
  '/api/'
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for API routes, static files, and Next.js internals
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // Get the token from cookies
  const token = request.cookies.get('auth-token')?.value;

  // Verify if user is authenticated
  let isAuthenticated = false;
  let user = null;

  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback-secret');
      const { payload } = await jwtVerify(token, secret);
      isAuthenticated = true;
      user = payload;
    } catch (error) {
      // Token is invalid, remove it
      console.log('Invalid token, removing cookie');
      isAuthenticated = false;
    }
  }

  // Handle protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
    
    // User is authenticated, allow access to protected routes
    return NextResponse.next();
  }

  // Handle public routes (login, signup, etc.)
  if (publicRoutes.includes(pathname)) {
    if (isAuthenticated) {
      // Redirect authenticated users to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // User is not authenticated, allow access to public routes
    return NextResponse.next();
  }

  // Handle root redirect
  if (pathname === '/') {
    if (isAuthenticated) {
      // Redirect authenticated users to dashboard
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    
    // Allow unauthenticated users to see homepage
    return NextResponse.next();
  }

  // For all other routes, continue normally
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
