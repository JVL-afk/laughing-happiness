// lib/auth-middleware.ts
// COMPLETE AUTH MIDDLEWARE - Includes all missing exports

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

    // Verify JWT token
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    } catch (error) {
      console.error('JWT verification failed:', error);
      return null;
    }

    // Get user from database
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ 
      _id: decoded.userId 
    });

    if (!user) {
      return null;
    }

    // Return authenticated user data
    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.fullName || user.name,
      plan: user.plan || 'basic',
      websitesCreated: user.websitesCreated || 0,
      websiteLimit: user.websiteLimit || 3
    };

  } catch (error) {
    console.error('Authentication error:', error);
    return null;
  }
}

// ALIAS for backward compatibility
export const authenticateRequest = authenticateUser;

export function createAuthResponse(message: string, status: number = 401) {
  return {
    error: 'Authentication failed',
    message,
    requiresAuth: true
  };
}

// Plan requirement functions
export async function requirePremium(request: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await authenticateUser(request);
  if (!user) return null;
  
  if (user.plan === 'basic') {
    return null; // Requires premium or enterprise
  }
  
  return user;
}

export async function requireEnterprise(request: NextRequest): Promise<AuthenticatedUser | null> {
  const user = await authenticateUser(request);
  if (!user) return null;
  
  if (user.plan !== 'enterprise') {
    return null; // Requires enterprise only
  }
  
  return user;
}

// Helper function to check if user has premium features
export function hasPremiumAccess(plan: string): boolean {
  return plan === 'pro' || plan === 'enterprise';
}

// Helper function to check if user has enterprise features
export function hasEnterpriseAccess(plan: string): boolean {
  return plan === 'enterprise';
}

// Get user plan limits
export function getPlanLimits(plan: string) {
  switch (plan) {
    case 'basic':
      return {
        websiteLimit: 3,
        analysisLimit: 10,
        apiAccess: false,
        prioritySupport: false
      };
    case 'pro':
      return {
        websiteLimit: 10,
        analysisLimit: 100,
        apiAccess: false,
        prioritySupport: true
      };
    case 'enterprise':
      return {
        websiteLimit: -1, // Unlimited
        analysisLimit: -1, // Unlimited
        apiAccess: true,
        prioritySupport: true
      };
    default:
      return {
        websiteLimit: 3,
        analysisLimit: 10,
        apiAccess: false,
        prioritySupport: false
      };
  }
}

// Middleware wrapper for API routes
export function withAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await authenticateUser(request);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Authentication required',
        message: 'Please log in to access this resource'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return handler(request, user);
  };
}

// Middleware wrapper for premium features
export function withPremium(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await requirePremium(request);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Premium access required',
        message: 'This feature requires a Pro or Enterprise plan',
        upgradeRequired: true
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return handler(request, user);
  };
}

// Middleware wrapper for enterprise features
export function withEnterprise(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest) => {
    const user = await requireEnterprise(request);
    if (!user) {
      return new Response(JSON.stringify({
        error: 'Enterprise access required',
        message: 'This feature requires an Enterprise plan',
        upgradeRequired: true
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return handler(request, user);
  };
}
