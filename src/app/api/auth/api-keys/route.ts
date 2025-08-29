// src/app/api/auth/api-keys/route.ts
// SIMPLIFIED - No more TypeScript judge arguments!

import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '../../../../lib/mongodb';
import { withErrorHandler, ErrorFactory, ValidationHelper } from '../../../../lib/error-handler';
import { authenticateUser, hasProAccess } from '../../../../lib/auth-middleware';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';

// Generate secure API key
function generateApiKey(): string {
  return 'ak_' + crypto.randomBytes(32).toString('hex');
}

// GET - Retrieve user's API keys (Premium feature)
async function getUserApiKeys(request: NextRequest): Promise<NextResponse> {
  // Authenticate user (premium feature)
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    }, { status: 401 });
  }

  // Check if user has premium access
  if (!hasProAccess(user)) {
    return NextResponse.json({
      error: 'Pro subscription required',
      message: 'API keys are a premium feature. Please upgrade to Pro or Enterprise plan.',
      requiresUpgrade: true,
      currentPlan: user.plan
    }, { status: 403 });
  }

  try {
    const { db } = await connectToDatabase();
    
    // Get user's API keys
    const apikeys = await db.collection('api_keys').find({
      userId: user.userId,
      isActive: true
    }).sort({ createdAt: -1 }).toArray();

    return NextResponse.json({
      success: true,
      apiKeys: apikeys.map(key => ({
        id: key._id,
        name: key.name,
        keyPreview: key.key.substring(0, 8) + '...',
        createdAt: key.createdAt,
        lastUsed: key.lastUsed,
        isActive: key.isActive
      }))
    });

  } catch (error) {
    console.error('Error fetching API keys:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to fetch API keys'
    }, { status: 500 });
  }
}

// POST - Create new API key (Premium feature)
async function createApiKey(request: NextRequest): Promise<NextResponse> {
  // Authenticate user (premium feature)
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    }, { status: 401 });
  }

  // Check if user has premium access
  if (!hasProAccess(user)) {
    return NextResponse.json({
      error: 'Pro subscription required',
      message: 'API keys are a premium feature. Please upgrade to Pro or Enterprise plan.',
      requiresUpgrade: true,
      currentPlan: user.plan
    }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name } = body;

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({
        error: 'Invalid input',
        message: 'API key name is required'
      }, { status: 400 });
    }

    if (name.length > 50) {
      return NextResponse.json({
        error: 'Invalid input',
        message: 'API key name must be 50 characters or less'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Check API key limit based on plan
    const existingKeys = await db.collection('api_keys').countDocuments({
      userId: user.userId,
      isActive: true
    });

    const keyLimit = user.plan === 'enterprise' ? 10 : 3; // Pro: 3, Enterprise: 10
    if (existingKeys >= keyLimit) {
      return NextResponse.json({
        error: 'API key limit reached',
        message: `You have reached your API key limit of ${keyLimit}. ${user.plan === 'pro' ? 'Upgrade to Enterprise for more API keys.' : 'Please delete unused keys.'}`,
        requiresUpgrade: user.plan === 'pro'
      }, { status: 403 });
    }

    // Generate new API key
    const apiKey = generateApiKey();
    const keyData = {
      _id: new ObjectId(),
      userId: user.userId,
      name: name.trim(),
      key: apiKey,
      createdAt: new Date(),
      lastUsed: null,
      isActive: true,
      permissions: ['read', 'write'] // Default permissions
    };

    // Save to database
    await db.collection('api_keys').insertOne(keyData);

    return NextResponse.json({
      success: true,
      message: 'API key created successfully',
      apiKey: {
        id: keyData._id,
        name: keyData.name,
        key: apiKey, // Only show full key once during creation
        createdAt: keyData.createdAt
      }
    });

  } catch (error) {
    console.error('Error creating API key:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to create API key'
    }, { status: 500 });
  }
}

// DELETE - Revoke API key (Premium feature)
async function deleteApiKey(request: NextRequest): Promise<NextResponse> {
  // Authenticate user (premium feature)
  const user = await authenticateUser(request);
  if (!user) {
    return NextResponse.json({
      error: 'Authentication required',
      message: 'Please log in to access this feature'
    }, { status: 401 });
  }

  // Check if user has premium access
  if (!hasProAccess(user)) {
    return NextResponse.json({
      error: 'Pro subscription required',
      message: 'API keys are a premium feature. Please upgrade to Pro or Enterprise plan.',
      requiresUpgrade: true,
      currentPlan: user.plan
    }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const keyId = searchParams.get('id');

    if (!keyId) {
      return NextResponse.json({
        error: 'Invalid input',
        message: 'API key ID is required'
      }, { status: 400 });
    }

    const { db } = await connectToDatabase();
    
    // Delete API key (only user's own keys)
    const result = await db.collection('api_keys').updateOne(
      { 
        _id: new ObjectId(keyId),
        userId: user.userId 
      },
      { 
        $set: { 
          isActive: false,
          revokedAt: new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({
        error: 'API key not found',
        message: 'The specified API key was not found or does not belong to you'
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'API key revoked successfully'
    });

  } catch (error) {
    console.error('Error deleting API key:', error);
    return NextResponse.json({
      error: 'Internal server error',
      message: 'Failed to revoke API key'
    }, { status: 500 });
  }
}

// Export handlers
export const GET = withErrorHandler(getUserApiKeys);
export const POST = withErrorHandler(createApiKey);
export const DELETE = withErrorHandler(deleteApiKey);
