// 🚀 DATABASE HEALTH CHECK API ROUTE
// File: src/app/api/database/health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { checkDatabaseHealth, getDatabaseStatus } from '@/lib/mongodb-new';

export async function GET(request: NextRequest) {
  console.log('🔄 Database health check requested...');
  
  try {
    // Get detailed database status
    const status = await getDatabaseStatus();
    
    if (status.connected) {
      console.log('✅ Database health check passed');
      return NextResponse.json(
        {
          success: true,
          message: 'Database is healthy',
          status: 'connected',
          details: {
            database: status.database,
            collections: status.collections,
            dataSize: status.dataSize,
            indexSize: status.indexSize,
            connectionString: status.connectionString,
            timestamp: new Date().toISOString()
          }
        },
        { status: 200 }
      );
    } else {
      console.log('❌ Database health check failed:', status.error);
      return NextResponse.json(
        {
          success: false,
          message: 'Database connection failed',
          status: 'disconnected',
          error: status.error,
          connectionString: status.connectionString,
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }
    
  } catch (error) {
    console.error('❌ Health check error:', error);
    
    return NextResponse.json(
      {
        success: false,
        message: 'Health check failed',
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}

// Simple health check endpoint
export async function HEAD(request: NextRequest) {
  try {
    const isHealthy = await checkDatabaseHealth();
    return new NextResponse(null, {
      status: isHealthy ? 200 : 503,
      headers: {
        'X-Database-Status': isHealthy ? 'healthy' : 'unhealthy',
        'X-Timestamp': new Date().toISOString()
      }
    });
  } catch (error) {
    return new NextResponse(null, {
      status: 500,
      headers: {
        'X-Database-Status': 'error',
        'X-Timestamp': new Date().toISOString()
      }
    });
  }
}
