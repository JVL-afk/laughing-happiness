// 🔐 ENHANCED AFFILIFY LOGIN API ROUTE - FINAL VERSION
// File: src/app/api/auth/login-enhanced/route.ts

import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { connectToDatabase, getUserCollection } from '@/lib/mongodb-new';
import { z } from 'zod';

// Environment variables validation
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// Enhanced request validation schema
const loginSchema = z.object({
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(128, 'Password must be less than 128 characters'),
  rememberMe: z.boolean().default(false),
  deviceInfo: z.object({
    name: z.string().optional(),
    type: z.string().optional(),
    os: z.string().optional(),
    browser: z.string().optional()
  }).optional()
});

// Security constants
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes
const SESSION_DURATION = 24 * 60 * 60; // 24 hours
const REMEMBER_ME_DURATION = 30 * 24 * 60 * 60; // 30 days

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const clientIP = request.headers.get('x-forwarded-for') || 'unknown';
  const userAgent = request.headers.get('user-agent') || 'unknown';
  
  console.log('🔄 Processing enhanced login request from:', clientIP);
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('📝 Login attempt for email:', body.email);
    
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('❌ Validation failed:', validationResult.error.issues);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid login credentials',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe, deviceInfo } = validationResult.data;

    // Connect to database with enhanced error handling
    console.log('🔄 Connecting to database...');
    let db, users;
    try {
      const connection = await connectToDatabase();
      db = connection.db;
      users = await getUserCollection();
    } catch (dbError) {
      console.error('❌ Database connection failed:', dbError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
          code: 'DB_CONNECTION_ERROR'
        },
        { status: 503 }
      );
    }

    // Find user and check account status
    console.log('🔍 Looking up user...');
    let user;
    try {
      user = await users.findOne({ email });
      if (!user) {
        console.log('❌ User not found:', email);
        // Use generic error message to prevent email enumeration
        return NextResponse.json(
          { 
            success: false,
            error: 'Invalid email or password',
            code: 'INVALID_CREDENTIALS'
          },
          { status: 401 }
        );
      }
    } catch (queryError) {
      console.error('❌ Database query failed:', queryError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Service temporarily unavailable. Please try again later.',
          code: 'DB_QUERY_ERROR'
        },
        { status: 503 }
      );
    }

    // Check if account is locked
    if (user.security?.lockedUntil && user.security.lockedUntil > new Date()) {
      const lockTimeRemaining = Math.ceil((user.security.lockedUntil.getTime() - new Date().getTime()) / 1000 / 60);
      console.log('🔒 Account locked for user:', email, 'Time remaining:', lockTimeRemaining, 'minutes');
      return NextResponse.json(
        { 
          success: false,
          error: `Account temporarily locked due to multiple failed login attempts. Try again in ${lockTimeRemaining} minutes.`,
          code: 'ACCOUNT_LOCKED',
          lockTimeRemaining
        },
        { status: 423 }
      );
    }

    // Check if account is active
    if (!user.isActive) {
      console.log('❌ Account deactivated:', email);
      return NextResponse.json(
        { 
          success: false,
          error: 'Account has been deactivated. Please contact support.',
          code: 'ACCOUNT_DEACTIVATED'
        },
        { status: 403 }
      );
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', email);
      
      // Increment login attempts
      const loginAttempts = (user.security?.loginAttempts || 0) + 1;
      const updateData = {
        'security.loginAttempts': loginAttempts,
        'security.lastFailedLogin': new Date()
      };
      
      // Lock account if max attempts reached
      if (loginAttempts >= MAX_LOGIN_ATTEMPTS) {
        updateData['security.lockedUntil'] = new Date(Date.now() + LOCKOUT_DURATION);
        console.log('🔒 Account locked due to max login attempts:', email);
      }
      
      try {
        await users.updateOne({ _id: user._id }, { $set: updateData });
      } catch (updateError) {
        console.error('❌ Failed to update login attempts:', updateError);
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid email or password',
          code: 'INVALID_CREDENTIALS',
          attemptsRemaining: loginAttempts >= MAX_LOGIN_ATTEMPTS ? 0 : MAX_LOGIN_ATTEMPTS - loginAttempts
        },
        { status: 401 }
      );
    }

    // Password is valid - reset security counters and update login info
    console.log('✅ Password verified for user:', email);
    
    // Generate session ID
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Create session object
    const session = {
      id: sessionId,
      createdAt: new Date(),
      lastActivity: new Date(),
      ipAddress: clientIP,
      userAgent,
      deviceInfo: deviceInfo || {},
      isActive: true,
      expiresAt: new Date(Date.now() + (rememberMe ? REMEMBER_ME_DURATION * 1000 : SESSION_DURATION * 1000))
    };

    // Update user document with login info
    const updateData = {
      lastLogin: new Date(),
      'security.loginAttempts': 0,
      'security.lockedUntil': null,
      'security.lastSuccessfulLogin': new Date(),
      $push: {
        'security.sessions': {
          $each: [session],
          $slice: -10 // Keep only last 10 sessions
        }
      }
    };

    try {
      await users.updateOne({ _id: user._id }, updateData);
      console.log('✅ User login info updated');
    } catch (updateError) {
      console.error('❌ Failed to update user login info:', updateError);
      // Continue with login even if update fails
    }

    // Generate JWT token with comprehensive claims
    console.log('🎫 Generating JWT token...');
    const tokenPayload = {
      userId: user._id.toString(),
      sessionId,
      email: user.email,
      fullName: user.fullName,
      plan: user.plan,
      features: user.features || [],
      websitesCreated: user.websitesCreated || 0,
      websiteLimit: user.websiteLimit || 3,
      isEmailVerified: user.emailVerified || false,
      subscription: {
        status: user.subscription?.status || 'active',
        plan: user.subscription?.plan || user.plan,
        trialEndsAt: user.subscription?.trialEndsAt
      },
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: rememberMe ? '30d' : '24h',
      issuer: 'affilify',
      audience: 'affilify-users',
      algorithm: 'HS256'
    });

    // Prepare response data (exclude sensitive information)
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
      },
      settings: user.settings || {}
    };

    // Create response with security headers
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Login successful! Welcome back to Affilify!',
        user: responseUser,
        session: {
          id: sessionId,
          expiresAt: session.expiresAt,
          rememberMe
        }
      },
      { status: 200 }
    );

    // Set secure JWT cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: rememberMe ? REMEMBER_ME_DURATION : SESSION_DURATION,
      path: '/'
    });

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    const processingTime = Date.now() - startTime;
    console.log(`✅ Login completed successfully for: ${email} (${processingTime}ms)`);
    
    return response;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Login error (${processingTime}ms):`, error);
    
    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request format. Please check your data.',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      );
    }
    
    if (error.name === 'JsonWebTokenError') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Authentication failed. Please try again.',
          code: 'TOKEN_ERROR'
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { 
        success: false,
        error: 'Internal server error. Please try again later.',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { status: 500 }
    );
  }
}

// Logout endpoint
export async function DELETE(request: NextRequest) {
  console.log('🔄 Processing logout request...');
  
  try {
    // Get token from cookie
    const token = request.cookies.get('auth-token')?.value;
    
    if (token) {
      try {
        // Verify and decode token
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        
        // Connect to database and invalidate session
        const connection = await connectToDatabase();
        const users = await getUserCollection();
        
        await users.updateOne(
          { _id: decoded.userId },
          { 
            $set: { 
              'security.sessions.$[session].isActive': false,
              'security.sessions.$[session].loggedOutAt': new Date()
            }
          },
          { 
            arrayFilters: [{ 'session.id': decoded.sessionId }] 
          }
        );
        
        console.log('✅ Session invalidated for user:', decoded.email);
      } catch (tokenError) {
        console.log('⚠️ Invalid token during logout:', tokenError.message);
      }
    }

    // Create response and clear cookie
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Logged out successfully'
      },
      { status: 200 }
    );

    // Clear auth cookie
    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;

  } catch (error) {
    console.error('❌ Logout error:', error);
    
    // Still clear the cookie even if there's an error
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Logged out successfully'
      },
      { status: 200 }
    );

    response.cookies.set('auth-token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/'
    });

    return response;
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
