// src/app/api/auth/login/route.ts
// OBJECTID-BASED LOGIN - No JWT, Direct ObjectID Storage

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({
        error: 'Email and password are required'
      }, { status: 400 });
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Find user by email
    const user = await db.collection('users').findOne({ email: email.toLowerCase() });

    if (!user) {
      return NextResponse.json({
        error: 'Invalid email or password'
      }, { status: 401 });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return NextResponse.json({
        error: 'Invalid email or password'
      }, { status: 401 });
    }

    // Update last login
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLogin: new Date() } }
    );

    console.log('🔍 LOGIN SUCCESS: ObjectID stored for user:', user._id.toString());

    // Create response with ObjectID (NO JWT!)
    const response = NextResponse.json({
      success: true,
      message: 'Login successful',
      objectId: user._id.toString(), // Send ObjectID to frontend
      user: {
        id: user._id.toString(),
        name: user.fullName || user.name || 'User',
        email: user.email,
        plan: user.plan || 'basic',
        websitesCreated: user.websitesCreated || 0
      }
    });

    // Store ObjectID in multiple cookies for reliability
    const cookieOptions = {
      httpOnly: false, // Allow frontend access
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    };

    response.cookies.set('user-id', user._id.toString(), cookieOptions);
    response.cookies.set('auth-id', user._id.toString(), cookieOptions);
    response.cookies.set('userId', user._id.toString(), cookieOptions);
    response.cookies.set('objectId', user._id.toString(), cookieOptions);

    return response;

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}
