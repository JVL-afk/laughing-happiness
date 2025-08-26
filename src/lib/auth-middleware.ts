// lib/auth-middleware.ts
// AUTHENTICATION MIDDLEWARE - Fixes JWT token handling

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

export function createAuthResponse(message: string, status: number = 401) {
  return {
    error: 'Authentication failed',
    message,
    requiresAuth: true
  };
}
