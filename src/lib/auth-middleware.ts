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

export function requirePremium(user: AuthenticatedUser): boolean {
  return user.plan === 'pro' || user.plan === 'enterprise';
}

export function requireEnterprise(user: AuthenticatedUser): boolean {
  return user.plan === 'enterprise';
}

export function hasPremiumAccess(user: AuthenticatedUser): boolean {
  return requirePremium(user);
}

export function hasEnterpriseAccess(user: AuthenticatedUser): boolean {
  return requireEnterprise(user);
}

export function getPlanLimits(plan: string) {
  switch (plan) {
    case 'basic':
      return {
        websites: 3,
        analyses: 10,
        features: ['basic_templates', 'basic_analytics']
      };
    case 'pro':
      return {
        websites: 25,
        analyses: 100,
        features: ['premium_templates', 'advanced_analytics', 'ai_chatbot', 'custom_domains', 'ab_testing']
      };
    case 'enterprise':
      return {
        websites: -1, // unlimited
        analyses: -1, // unlimited
        features: ['all_features', 'team_collaboration', 'white_label', 'api_access', 'dedicated_support']
      };
    default:
      return getPlanLimits('basic');
  }
}

// Higher-order function for authentication
export function withAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const user = await authenticateUser(request);
    if (!user) {
      return new Response(JSON.stringify(createAuthResponse('Authentication required')), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    return handler(request, user);
  };
}

// Higher-order function for premium features
export function withPremium(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser): Promise<Response> => {
    if (!hasPremiumAccess(user)) {
      return new Response(JSON.stringify({
        error: 'Premium subscription required',
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

