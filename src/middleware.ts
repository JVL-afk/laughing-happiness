// src/middleware.ts
// OBJECTID-BASED MIDDLEWARE - Simple ObjectID Cookie Check

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/signup',
    '/pricing',
    '/documentation',
    '/about',
    '/api/auth/login',
    '/api/auth/signup'
  ];

  // Check if current path is public
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith('/api/auth/')
  );

  if (isPublicRoute) {
    return NextResponse.next();
  }

  // For protected routes, check ObjectID authentication
  const userObjectId = request.cookies.get('user-id')?.value ||
                       request.cookies.get('auth-id')?.value ||
                       request.cookies.get('userId')?.value ||
                       request.cookies.get('objectId')?.value;

  console.log('🔍 MIDDLEWARE DEBUG:', {
    path: pathname,
    hasObjectId: !!userObjectId,
    objectIdLength: userObjectId?.length || 0
  });

  // If no ObjectID found, redirect to login
  if (!userObjectId) {
    console.log('🔍 MIDDLEWARE: No ObjectID found, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Basic ObjectID format validation (24 character hex string)
  if (userObjectId.length !== 24 || !/^[0-9a-fA-F]{24}$/.test(userObjectId)) {
    console.log('🔍 MIDDLEWARE: Invalid ObjectID format, redirecting to login');
    return NextResponse.redirect(new URL('/login', request.url));
  }

  console.log('🔍 MIDDLEWARE: Valid ObjectID found, allowing access');
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

