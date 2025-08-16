// 🚀 ENHANCED AFFILIFY LOGIN API ROUTE
// File: src/app/api/auth/login-new/route.ts

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
const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().default(false),
});

export async function POST(request: NextRequest) {
  console.log('🔄 Processing login request...');
  
  try {
    // Parse and validate request body
    const body = await request.json();
    console.log('📝 Login attempt for:', body.email);
    
    const validationResult = loginSchema.safeParse(body);
    if (!validationResult.success) {
      console.log('❌ Validation failed:', validationResult.error.issues);
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues.map(issue => ({
            field: issue.path.join('.'),
            message: issue.message
          }))
        },
        { status: 400 }
      );
    }

    const { email, password, rememberMe } = validationResult.data;

    // Connect to database
    console.log('🔄 Connecting to database...');
    const { db } = await connectToDatabase();
    const users = await getUserCollection();

    // Find user by email
    console.log('🔍 Looking up user...');
    const user = await users.findOne({ 
      email: email.toLowerCase() 
    });

    if (!user) {
      console.log('❌ User not found:', email);
      // Use generic error message to prevent email enumeration
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      console.log('❌ User account is deactivated:', email);
      return NextResponse.json(
        { error: 'Account is deactivated. Please contact support.' },
        { status: 403 }
      );
    }

    // Verify password
    console.log('🔐 Verifying password...');
    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      console.log('❌ Invalid password for user:', email);
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    // Update last login timestamp
    await users.updateOne(
      { _id: user._id },
      { 
        $set: { 
          lastLogin: new Date(),
          updatedAt: new Date()
        }
      }
    );

    // Generate JWT token
    console.log('🎫 Generating JWT token...');
    const tokenPayload = {
      userId: user._id.toString(),
      email: user.email,
      plan: user.plan,
      fullName: user.fullName
    };

    // Set token expiration based on rememberMe option
    const expiresIn = rememberMe ? '30d' : '7d';
    const maxAge = rememberMe ? 30 * 24 * 60 * 60 : 7 * 24 * 60 * 60; // seconds

    const token = jwt.sign(tokenPayload, JWT_SECRET, { 
      expiresIn,
      issuer: 'affilify',
      audience: 'affilify-users'
    });

    // Prepare response data (exclude sensitive information)
    const responseUser = {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      plan: user.plan,
      websitesCreated: user.websitesCreated,
      websiteLimit: user.websiteLimit,
      features: user.features || [],
      createdAt: user.createdAt,
      lastLogin: new Date(),
      subscription: {
        status: user.subscription?.status || 'active',
        plan: user.subscription?.plan || user.plan
      },
      settings: user.settings || {
        notifications: { email: true, marketing: false, updates: true },
        privacy: { profilePublic: false, analyticsSharing: false }
      }
    };

    // Create response
    const response = NextResponse.json(
      { 
        success: true,
        message: 'Login successful! Welcome back!',
        user: responseUser
      },
      { status: 200 }
    );

    // Set secure JWT cookie
    response.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge,
      path: '/'
    });

    console.log('✅ Login completed successfully for:', email);
    return response;

  } catch (error) {
    console.error('❌ Login error:', error);
    
    // Handle specific MongoDB errors
    if (error instanceof Error) {
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
