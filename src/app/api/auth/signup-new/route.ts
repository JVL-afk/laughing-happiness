// 🚀 ENHANCED AFFILIFY SIGNUP API ROUTE
// File: src/app/api/auth/signup-new/route.ts

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

// Request validation schema
const signupSchema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters').max(100),
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  plan: z.enum(['basic', 'pro', 'enterprise']).default('basic'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export async function POST(request: NextRequest) {
  console.log('🔄 Processing signup request...');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('📝 Request body received:', { ...body, password: '***', confirmPassword: '***' });
    
    const validationResult = signupSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('❌ Validation failed:', validationResult.error.issues);
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { fullName, email, password, plan } = validationResult.data;

    // Connect to database
    console.log('🔄 Connecting to database...');
    const { db } = await connectToDatabase();
    const users = await getUserCollection();

    // Check if user already exists
    console.log('🔍 Checking for existing user...');
    const existingUser = await users.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return NextResponse.json(
        { error: 'User already exists with this email address' },
        { status: 409 }
      );
    }

    // Hash password
    console.log('🔐 Hashing password...');
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Determine plan limits
    const planLimits = {
      basic: { websiteLimit: 3, features: ['basic_templates', 'basic_analytics'] },
      pro: { websiteLimit: 10, features: ['pro_templates', 'advanced_analytics', 'custom_domains'] },
      enterprise: { websiteLimit: -1, features: ['all_templates', 'enterprise_analytics', 'white_label', 'api_access'] }
    };

    // Create user document
    const newUser = {
      fullName: fullName.trim(),
      email: email.toLowerCase(),
      password: hashedPassword,
      plan,
      websitesCreated: 0,
      websiteLimit: planLimits[plan].websiteLimit,
      features: planLimits[plan].features,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true,
      emailVerified: false,
      subscription: {
        status: plan === 'basic' ? 'active' : 'pending',
        plan,
        startDate: new Date(),
        endDate: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null
      },
      profile: {
        avatar: null,
        bio: null,
        website: null,
        social: {
          twitter: null,
          linkedin: null,
          facebook: null
        }
      },
      settings: {
        notifications: {
          email: true,
          marketing: false,
          updates: true
        },
        privacy: {
          profilePublic: false,
          analyticsSharing: false
        }
      }
    };

    // Insert user into database
    console.log('💾 Creating user in database...');
    const result = await users.insertOne(newUser);
    console.log('✅ User created with ID:', result.insertedId);

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const tokenPayload = {
      userId: result.insertedId.toString(),
      email: email.toLowerCase(),
      plan,
      fullName: fullName.trim()
    };

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn: '7d',
      issuer: 'affilify',
      audience: 'affilify-users'
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
      subscription: {
        status: newUser.subscription.status,
        plan: newUser.subscription.plan
      }
    };

    // Create response
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Account created successfully! Welcome to Affilify!',
        user: responseUser
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

    console.log('✅ Signup completed successfully for:', email);
    return response;

  } catch (error) {
    console.error('❌ Signup error:', error);
    
    // Handle specific MongoDB errors
    if (error instanceof Error) {
      if (error.message.includes('E11000')) {
        return NextResponse.json(
          { error: 'User already exists with this email address' },
          { status: 409 }
        );
      }
      
      if (error.message.includes('authentication failed')) {
        return NextResponse.json(
          { error: 'Database authentication failed. Please try again later.' },
          { status: 503 }
        );
      }
      
      if (error.message.includes('Server selection timed out')) {
        return NextResponse.json(
          { error: 'Database connection timeout. Please try again later.' },
          { status: 503 }
        );
      }
    }

    return NextResponse.json(
      { 
        error: 'Internal server error. Please try again later.',
        details: process.env.NODE_ENV === 'development' ? error instanceof Error ? error.message : 'Unknown error' : undefined
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
