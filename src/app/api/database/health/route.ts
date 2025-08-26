// app/api/database/health/route.ts
// COMPLETE FIXED VERSION - Resolves all TypeScript errors

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    // Test database connection
    const { db } = await connectToDatabase();
    
    // Perform basic health check
    await db.admin().ping();
    
    // Get basic database stats
    const collections = await db.listCollections().toArray();
    const userCollection = db.collection('users');
    const websiteCollection = db.collection('websites');
    
    const userCount = await userCollection.countDocuments();
    const websiteCount = await websiteCollection.countDocuments();
    
    // Return successful health check
    return NextResponse.json({
      status: 'connected',
      message: '✅ Database health check passed',
      details: {
        database: 'affilify',
        collections: collections.map(c => c.name),
        stats: {
          users: userCount,
          websites: websiteCount,
          totalCollections: collections.length
        },
        connectionString: process.env.MONGODB_URI ? 'Configured' : 'Missing',
        timestamp: new Date().toISOString()
      }
    }, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });

  } catch (error) {
    console.error('Database health check failed:', error);
    
    return NextResponse.json({
      status: 'error',
      message: '❌ Database health check failed',
      error: error.message,
      details: {
        connectionString: process.env.MONGODB_URI ? 'Configured' : 'Missing',
        timestamp: new Date().toISOString()
      }
    }, {
      status: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }
    });
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
