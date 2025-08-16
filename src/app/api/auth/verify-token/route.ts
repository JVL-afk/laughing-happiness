// 🎫 TOKEN VERIFICATION API ROUTE
// File: src/app/api/auth/verify-token/route.ts

import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { connectToDatabase, getUserCollection } from '@/lib/mongodb-new';

// Environment variables validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

export async function GET(request: NextRequest) {
  console.log('🔄 Processing token verification request...');
  
  try {
    // Get token from cookie or Authorization header
    let token = request.cookies.get('auth-token')?.value;
    
    if (!token) {
      const authHeader = request.headers.get('authorization');
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return NextResponse.json(
        { 
          success: false,
          error: 'No authentication token provided',
          code: 'NO_TOKEN'
        },
        { status: 401 }
      );
    }

    // Verify JWT token
    console.log('🔍 Verifying JWT token...');
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as any;
    } catch (tokenError) {
      console.log('❌ Invalid token:', tokenError.message);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid or expired token',
          code: 'INVALID_TOKEN'
        },
        { status: 401 }
      );
    }

    // Connect to database and verify user exists
    console.log('🔄 Connecting to database...');
    let users;
    try {
      const connection = await connectToDatabase();
      users = await getUserCollection();
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DB_CONNECTION_ERROR'
        },
        { status: 503 }
      );
    }

    // Find user and verify session
    console.log('🔍 Verifying user and session...');
    let user;
    try {
      user = await users.findOne({ _id: decoded.userId });
      if (!user) {
        console.log('❌ User not found:', decoded.userId);
        return NextResponse.json(
          { 
            success: false,
            error: 'User not found',
            code: 'USER_NOT_FOUND'
          },
          { status: 401 }
        );
      }
    } catch (queryError) {
      console.error('❌ Database query failed:', queryError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Service temporarily unavailable',
          code: 'DB_QUERY_ERROR'
        },
        { status: 503 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Account has been deactivated',
          code: 'ACCOUNT_DEACTIVATED'
        },
        { status: 403 }
      );
    }

    // Verify session if sessionId is present
    if (decoded.sessionId) {
      const session = user.security?.sessions?.find(s => s.id === decoded.sessionId);
      if (!session || !session.isActive || session.expiresAt < new Date()) {
        return NextResponse.json(
          { 
            success: false,
            error: 'Session expired or invalid',
            code: 'SESSION_EXPIRED'
          },
          { status: 401 }
        );
      }

      // Update last activity
      try {
        await users.updateOne(
          { _id: user._id, 'security.sessions.id': decoded.sessionId },
          { $set: { 'security.sessions.$.lastActivity': new Date() } }
        );
      } catch (updateError) {
        console.error('❌ Failed to update session activity:', updateError);
        // Continue even if update fails
      }
    }

    // Prepare user data for response
    const responseUser = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      plan: user.plan,
      websitesCreated: user.websitesCreated || 0,
      websiteLimit: user.websiteLimit || 3,
      features: user.features || [],
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      emailVerified: user.emailVerified || false,
      onboardingCompleted: user.onboardingCompleted || false,
      subscription: {
        status: user.subscription?.status || 'active',
        plan: user.subscription?.plan || user.plan,
        trialEndsAt: user.subscription?.trialEndsAt
      },
      profile: {
        avatar: user.profile?.avatar,
        bio: user.profile?.bio,
        website: user.profile?.website,
        company: user.profile?.company,
        location: user.profile?.location
      }
    };

    console.log('✅ Token verification successful for user:', user.email);

    return NextResponse.json(
      { 
        success: true,
        message: 'Token is valid',
        user: responseUser,
        tokenInfo: {
          issuedAt: new Date(decoded.iat * 1000),
          expiresAt: new Date(decoded.exp * 1000),
          sessionId: decoded.sessionId
        }
      },
      { status: 200 }
    );

  } catch (error) {
    console.error('❌ Token verification error:', error);
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
