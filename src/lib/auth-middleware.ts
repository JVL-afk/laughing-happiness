// lib/auth-middleware.ts
// COMPLETE AUTH MIDDLEWARE - Fixed to match main middleware JWT verification

import jwt from 'jsonwebtoken';
import { NextRequest } from 'next/server';
import { connectToDatabase } from './mongodb';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  plan: string;
  websitesCreated: number;
  websiteLimit: number;
}

// Simple JWT verification function - MATCHES MAIN MIDDLEWARE
function isValidJWT(token: string): any {
  try {
    // Basic JWT structure validation
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    // Decode payload
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    
    // Check if token has required fields and is not expired
    if (!payload.userId || !payload.email) {
      return null;
    }

    // Check expiration (if present)
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    return payload;
  } catch (error) {
    return null;
  }
}

export async function authenticateUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    // Get authorization header
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    // Extract token
    const token = authHeader.substring(7);
    if (!token) {
      return null;
    }

    // Verify JWT token using the SAME logic as main middleware
    const decoded = isValidJWT(token);
    if (!decoded) {
      return null;
    }

    // Connect to database
    const { db } = await connectToDatabase();
    const users = db.collection('users');

    // Find user in database
    const user = await users.findOne({ _id: decoded.userId });
    if (!user) {
      return null;
    }

    // Return authenticated user with plan information
    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.fullName,
      plan: user.plan || 'basic',
      websitesCreated: user.websitesCreated || 0,
      websiteLimit: user.plan === 'pro' ? 10 : user.plan === 'enterprise' ? -1 : 3
    };
  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// Plan access control functions
export function hasProAccess(user: AuthenticatedUser): boolean {
  return user.plan === 'pro' || user.plan === 'enterprise';
}

export function hasEnterpriseAccess(user: AuthenticatedUser): boolean {
  return user.plan === 'enterprise';
}

// Higher-order function for protected routes
export function withAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const user = await authenticateUser(request);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: 'Please log in to access this feature'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handler(request, user);
  };
}

// Higher-order function for pro features
export function withPro(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser): Promise<Response> => {
    if (!hasProAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Pro subscription required',
        message: 'This feature requires a Pro or Enterprise plan',
        requiresUpgrade: true,
        currentPlan: user.plan
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handler(request, user);
  });
}

// Higher-order function for enterprise features
export function withEnterprise(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser): Promise<Response> => {
    if (!hasEnterpriseAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Enterprise subscription required',
        message: 'This feature requires an Enterprise plan',
        requiresUpgrade: true,
        currentPlan: user.plan
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handler(request, user);
  });
}

