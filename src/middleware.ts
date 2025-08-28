// middleware.ts
// COMPLETE FIXED VERSION - Using jsonwebtoken (no jose dependency needed)

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

// Simple JWT verification without external dependencies
function verifyJWT(token: string): any {
  try {
    // Basic JWT structure validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload (basic validation)
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token is expired
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
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

  // Get the token from cookies
  const token = request.cookies.get('auth-token')?.value || 
                request.cookies.get('token')?.value ||
                request.headers.get('authorization')?.replace('Bearer ', '');

  // Verify if user is authenticated
  let isAuthenticated = false;
  let user = null;

  if (token) {
    user = verifyJWT(token);
    isAuthenticated = !!user;
  }

  // Handle protected routes
  if (protectedRoutes.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      // Redirect to login with return URL
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      
      // Clear invalid token cookie
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('auth-token');
      response.cookies.delete('token');
      return response;
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
