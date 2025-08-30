// src/app/api/auth/signup/route.ts
// OBJECTID-BASED SIGNUP - No JWT, Direct ObjectID Storage

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, password } = await request.json();

    if (!fullName || !email || !password) {
      return NextResponse.json({
        error: 'Full name, email, and password are required'
      }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({
        error: 'Password must be at least 6 characters long'
      }, { status: 400 });
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Check if user already exists
    const existingUser = await db.collection('users').findOne({ 
      email: email.toLowerCase() 
    });

    if (existingUser) {
      return NextResponse.json({
        error: 'User with this email already exists'
      }, { status: 409 });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = {
      fullName,
      name: fullName, // Backward compatibility
      email: email.toLowerCase(),
      password: hashedPassword,
      plan: 'basic',
      websitesCreated: 0,
      createdAt: new Date(),
      lastLogin: new Date()
    };

    // Insert user into database
    const result = await db.collection('users').insertOne(newUser);
    const objectId = result.insertedId.toString();

    console.log('🔍 SIGNUP SUCCESS: ObjectID created for user:', objectId);

    // Create response with ObjectID (NO JWT!)
    const response = NextResponse.json({
      success: true,
      message: 'Account created successfully',
      objectId: objectId, // Send ObjectID to frontend
      user: {
        id: objectId,
        name: fullName,
        email: email.toLowerCase(),
        plan: 'basic',
        websitesCreated: 0
      }
    });

    // Store ObjectID in multiple cookies for reliability
    const cookieOptions = {
      httpOnly: false, // Allow frontend access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    response.cookies.set('user-id', objectId, cookieOptions);
    response.cookies.set('auth-id', objectId, cookieOptions);
    response.cookies.set('userId', objectId, cookieOptions);
    response.cookies.set('objectId', objectId, cookieOptions);

    return response;

  } catch (error) {
    console.error('Signup error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
