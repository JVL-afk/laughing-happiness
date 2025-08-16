// 🚀 ENHANCED AFFILIFY SIGNUP API ROUTE - FINAL VERSION
// File: src/app/api/auth/signup-enhanced/route.ts

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
const signupSchema = z.object({
  fullName: z.string()
    .min(2, 'Full name must be at least 2 characters')
    .max(100, 'Full name must be less than 100 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name can only contain letters and spaces'),
  email: z.string()
    .email('Invalid email address')
    .toLowerCase()
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be less than 128 characters')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one lowercase letter, one uppercase letter, and one number'),
  confirmPassword: z.string(),
  plan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
  acceptTerms: z.boolean().refine(val => val === true, 'You must accept the terms and conditions'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Plan configuration
const PLAN_CONFIG = {
  basic: {
    websiteLimit: 3,
    features: ['basic_templates', 'basic_analytics', 'community_support'],
    price: 0,
    stripeProductId: null
  },
  pro: {
    websiteLimit: 10,
    features: ['pro_templates', 'advanced_analytics', 'custom_domains', 'priority_support', 'ai_optimization'],
    price: 29,
    stripeProductId: process.env.STRIPE_PRO_PRICE_ID
  },
  enterprise: {
    websiteLimit: -1, // unlimited
    features: ['all_templates', 'enterprise_analytics', 'white_label', 'api_access', 'dedicated_support', 'custom_integrations'],
    price: 99,
    stripeProductId: process.env.STRIPE_ENTERPRISE_PRICE_ID
  }
};

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log('🔄 Processing enhanced signup request...');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('📝 Request body received:', { 
      ...body, 
      password: '***', 
      confirmPassword: '***' 
    });
    
    const validationResult = signupSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('❌ Validation failed:', validationResult.error.issues);
      return NextResponse.json(
        { 
          success: false,
          error: 'Validation failed',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { fullName, email, password, plan, acceptTerms } = validationResult.data;
    const planConfig = PLAN_CONFIG[plan];

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
          error: 'Database connection failed. Please try again later.',
          code: 'DB_CONNECTION_ERROR'
        },
        { status: 503 }
      );
    }

    // Check if user already exists
    console.log('🔍 Checking for existing user...');
    try {
      const existingUser = await users.findOne({ email });
      if (existingUser) {
        console.log('❌ User already exists:', email);
        return NextResponse.json(
          { 
            success: false,
            error: 'An account with this email address already exists',
            code: 'USER_EXISTS'
          },
          { status: 409 }
        );
      }
    } catch (queryError) {
      console.error('❌ Database query failed:', queryError);
      return NextResponse.json(
        { 
          success: false,
          error: 'Database query failed. Please try again later.',
          code: 'DB_QUERY_ERROR'
        },
        { status: 503 }
      );
    }

    // Hash password with enhanced security
    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create comprehensive user document
    const newUser = {
      // Basic information
      fullName: fullName.trim(),
      email,
      password: hashedPassword,
      
      // Plan and subscription
      plan,
      websitesCreated: 0,
      websiteLimit: planConfig.websiteLimit,
      features: planConfig.features,
      
      // Timestamps
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLogin: null,
      
      // Status flags
      isActive: true,
      emailVerified: false,
      onboardingCompleted: false,
      
      // Subscription details
      subscription: {
        status: plan === 'basic' ? 'active' : 'pending',
        plan,
        startDate: new Date(),
        endDate: null,
        trialEndsAt: plan !== 'basic' ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : null, // 14 days trial
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        paymentMethod: null
      },
      
      // User profile
      profile: {
        avatar: null,
        bio: null,
        website: null,
        company: null,
        location: null,
        timezone: 'UTC',
        social: {
          twitter: null,
          linkedin: null,
          facebook: null,
          instagram: null
        }
      },
      
      // User preferences
      settings: {
        notifications: {
          email: true,
          marketing: false,
          updates: true,
          security: true
        },
        privacy: {
          profilePublic: false,
          analyticsSharing: false,
          dataProcessing: acceptTerms
        },
        ui: {
          theme: 'dark',
          language: 'en',
          timezone: 'UTC'
        }
      },
      
      // Analytics and tracking
      analytics: {
        signupSource: 'direct',
        referrer: null,
        utmSource: null,
        utmMedium: null,
        utmCampaign: null,
        ipAddress: request.headers.get('x-forwarded-for') || 'unknown',
        userAgent: request.headers.get('user-agent') || 'unknown'
      },
      
      // Security
      security: {
        passwordChangedAt: new Date(),
        loginAttempts: 0,
        lockedUntil: null,
        twoFactorEnabled: false,
        backupCodes: [],
        sessions: []
      }
    };

    // Insert user into database
    console.log('💾 Creating user in database...');
    let result;
    try {
      result = await users.insertOne(newUser);
      console.log('✅ User created with ID:', result.insertedId);
    } catch (insertError) {
      console.error('❌ User creation failed:', insertError);
      
      // Handle duplicate key error
      if (insertError.code === 11000) {
        return NextResponse.json(
          { 
            success: false,
            error: 'An account with this email address already exists',
            code: 'USER_EXISTS'
          },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { 
          success: false,
          error: 'Failed to create user account. Please try again later.',
          code: 'USER_CREATION_ERROR'
        },
        { status: 500 }
      );
    }

    // Generate JWT token with comprehensive claims
    console.log('🎫 Generating JWT token...');
    const tokenPayload = {
      userId: result.insertedId.toString(),
      email,
      plan,
      fullName: fullName.trim(),
      features: planConfig.features,
      isEmailVerified: false,
      iat: Math.floor(Date.now() / 1000),
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: '7d',
      issuer: 'affilify',
      audience: 'affilify-users',
      algorithm: 'HS256'
    });

    // Prepare response data (exclude sensitive information)
    const responseUser = {
      id: result.insertedId,
      fullName: newUser.fullName,
      email: newUser.email,
      plan: newUser.plan,
      websitesCreated: newUser.websitesCreated,
      websiteLimit: newUser.websiteLimit,
      features: newUser.features,
      createdAt: newUser.createdAt,
      emailVerified: newUser.emailVerified,
      subscription: {
        status: newUser.subscription.status,
        plan: newUser.subscription.plan,
        trialEndsAt: newUser.subscription.trialEndsAt
      }
    };

    // Create response with security headers
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Account created successfully! Welcome to Affilify!',
        user: responseUser,
        nextSteps: [
          'Verify your email address',
          'Complete your profile setup',
          'Create your first affiliate website'
        ]
      },
      { status: 201 }
    );

    // Set secure JWT cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/'
    });

    // Add security headers
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-XSS-Protection', '1; mode=block');

    const processingTime = Date.now() - startTime;
    console.log(`✅ Signup completed successfully for: ${email} (${processingTime}ms)`);
    
    return response;

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`❌ Signup error (${processingTime}ms):`, error);
    
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
          error: 'Token generation failed. Please try again.',
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

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    },
  });
}
