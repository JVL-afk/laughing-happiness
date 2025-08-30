// lib/auth-middleware.ts
// OBJECTID-BASED AUTHENTICATION - Simple, Reliable, Direct Database Access

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from './mongodb';
import { ObjectId } from 'mongodb';

export interface AuthenticatedUser {
    userId: string;
    email: string;
    name: string;
    plan: string;
    websitesCreated: number;
    websiteLimit: number;
    lastLogin: Date;
}

// Simple ObjectID-based authentication
export async function authenticateUser(request: NextRequest): Promise<AuthenticatedUser | null> {
    try {
          console.log('🔍 AUTH DEBUG: Starting ObjectID authentication...');

      // Get ObjectID from multiple sources
      let userObjectId = null;

      // 1. Try Authorization header (Bearer ObjectID)
      const authHeader = request.headers.get('authorization');
          if (authHeader && authHeader.startsWith('Bearer ')) {
                  userObjectId = authHeader.substring(7);
                  console.log('🔍 AUTH DEBUG: ObjectID from header:', userObjectId ? 'Found' : 'Not found');
          }

      // 2. Try cookies if no header
      if (!userObjectId) {
              userObjectId = request.cookies.get('user-id')?.value ||
                                    request.cookies.get('userId')?.value ||
                                    request.cookies.get('objectId')?.value ||
                                    request.cookies.get('auth-id')?.value;
              console.log('🔍 AUTH DEBUG: ObjectID from cookies:', userObjectId ? 'Found' : 'Not found');
      }

      if (!userObjectId) {
              console.log('🔍 AUTH DEBUG: No ObjectID found anywhere');
              return null;
      }

      console.log('🔍 AUTH DEBUG: ObjectID found, length:', userObjectId.length);

      // Validate ObjectID format
      if (!ObjectId.isValid(userObjectId)) {
              console.log('🔍 AUTH DEBUG: Invalid ObjectID format');
              return null;
      }

      // Connect to database
      const { db } = await connectToDatabase();
          console.log('🔍 AUTH DEBUG: Database connected');

      // Direct database lookup with ObjectID
      const user = await db.collection('users').findOne({ 
                                                              _id: new ObjectId(userObjectId) 
      });

      console.log('🔍 AUTH DEBUG: User lookup result:', user ? 'Found' : 'Not found');

      if (!user) {
              console.log('🔍 AUTH DEBUG: No user found with ObjectID');
              return null;
      }

      // Update last login
      await db.collection('users').updateOne(
        { _id: new ObjectId(userObjectId) },
        { $set: { lastLogin: new Date() } }
            );

      console.log('🔍 AUTH DEBUG: User authenticated successfully:', {
              id: user._id,
              email: user.email,
              name: user.fullName || user.name,
              plan: user.plan || 'basic'
      });

      // Return authenticated user data
      return {
              userId: user._id.toString(),
              email: user.email,
              name: user.fullName || user.name || 'User',
              plan: user.plan || 'basic',
              websitesCreated: user.websitesCreated || 0,
              websiteLimit: getWebsiteLimit(user.plan || 'basic'),
              lastLogin: new Date()
      };

    } catch (error) {
          console.error('🔍 AUTH DEBUG: Authentication error:', error);
          return null;
    }
}

// Get website limits based on plan
function getWebsiteLimit(plan: string): number {
    switch (plan) {
      case 'basic': return 3;
      case 'pro': return 25;
      case 'enterprise': return -1; // unlimited
      default: return 3;
    }
}

// Plan access control functions
export function hasProAccess(user: AuthenticatedUser): boolean {
    return user.plan === 'pro' || user.plan === 'enterprise';
}

export function hasEnterpriseAccess(user: AuthenticatedUser): boolean {
    return user.plan === 'enterprise';
}

// Check if user can create more websites
export function canCreateWebsite(user: AuthenticatedUser): boolean {
    if (user.websiteLimit === -1) return true; // unlimited
  return user.websitesCreated < user.websiteLimit;
}

// BACKWARD COMPATIBILITY - Legacy function names
export const authenticateRequest = authenticateUser;

// Premium access functions with proper return types
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
                currentPlan: user.plan,
                upgradeUrl: '/pricing'
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
                currentPlan: user.plan,
                upgradeUrl: '/pricing'
        }, { status: 403 });
  }

  return user;
}

// Higher-order function for basic authentication
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

// Higher-order function for pro features
export function withPro(handler: (request: NextRequest, user: Authenti
