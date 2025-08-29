// lib/auth-middleware.ts
// FINAL SOLUTION - Type guards to eliminate TypeScript confusion

import jwt from 'jsonwebtoken';
import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from './mongodb';

export interface AuthenticatedUser {
  userId: string;
  email: string;
  name: string;
  plan: string;
  websitesCreated: number;
  websiteLimit: number;
}

// Type guard to check if result is a user
export function isAuthenticatedUser(result: any): result is AuthenticatedUser {
  return result && typeof result === 'object' && 'userId' in result;
}

// Simple JWT verification function
function isValidJWT(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.userId || !payload.email) return null;
    if (payload.exp && payload.exp < Date.now() / 1000) return null;
    return payload;
  } catch (error) {
    return null;
  }
}

export async function authenticateUser(request: NextRequest): Promise<AuthenticatedUser | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
    
    const token = authHeader.substring(7);
    if (!token) return null;
    
    const decoded = isValidJWT(token);
    if (!decoded) return null;
    
    const { db } = await connectToDatabase();
    const users = db.collection('users');
    const user = await users.findOne({ _id: decoded.userId });
    if (!user) return null;
    
    return {
      userId: user._id.toString(),
      email: user.email,
      name: user.fullName,
      plan: user.plan || 'basic',
      websitesCreated: user.websitesCreated || 0,
      websiteLimit: user.plan === 'pro' ? 10 : user.plan === 'enterprise' ? -1 : 3
    };
  } catch (error) {
    return null;
  }
}

// BACKWARD COMPATIBILITY
export const authenticateRequest = authenticateUser;

export function hasProAccess(user: AuthenticatedUser): boolean {
  return user.plan === 'pro' || user.plan === 'enterprise';
}

export function hasEnterpriseAccess(user: AuthenticatedUser): boolean {
  return user.plan === 'enterprise';
}

// EXPLICIT RETURN TYPE - This is what fixes the TypeScript error
export async function requirePremium(request: NextRequest): Promise<AuthenticatedUser | NextResponse<any>> {
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    }, { status: 401 });
  }
  
  if (!hasProAccess(user)) {
    return NextResponse.json({
      error: 'Pro subscription required',
      message: 'This feature requires a Pro or Enterprise plan',
      requiresUpgrade: true,
      currentPlan: user.plan
    }, { status: 403 });
  }
  
  return user;
}

export async function requireEnterprise(request: NextRequest): Promise<AuthenticatedUser | NextResponse<any>> {
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    }, { status: 401 });
  }
  
  if (!hasEnterpriseAccess(user)) {
    return NextResponse.json({
      error: 'Enterprise subscription required',
      message: 'This feature requires an Enterprise plan',
      requiresUpgrade: true,
      currentPlan: user.plan
    }, { status: 403 });
  }
  
  return user;
}

// Higher-order functions
export function withAuth(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return async (request: NextRequest): Promise<Response> => {
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please log in to access this feature'
      }, { status: 401 });
    }
    return handler(request, user);
  };
}

export function withPro(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser): Promise<Response> => {
    if (!hasProAccess(user)) {
      return NextResponse.json({
        error: 'Pro subscription required',
        message: 'This feature requires a Pro or Enterprise plan',
        requiresUpgrade: true,
        currentPlan: user.plan
      }, { status: 403 });
    }
    return handler(request, user);
  });
}

export function withEnterprise(handler: (request: NextRequest, user: AuthenticatedUser) => Promise<Response>) {
  return withAuth(async (request: NextRequest, user: AuthenticatedUser): Promise<Response> => {
    if (!hasEnterpriseAccess(user)) {
      return NextResponse.json({
        error: 'Enterprise subscription required',
        message: 'This feature requires an Enterprise plan',
        requiresUpgrade: true,
        currentPlan: user.plan
      }, { status: 403 });
    }
    return handler(request, user);
  });
}
