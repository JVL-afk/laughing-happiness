// src/app/api/ai/generate-website/route.ts
// OBJECTID-BASED GENERATE-WEBSITE - Required Authentication with Limits

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, canCreateWebsite } from '@/lib/auth-middleware';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(request: NextRequest) {
  try {
    const { productUrl, niche, targetAudience, customization } = await request.json();

    if (!productUrl) {
      return NextResponse.json({
        error: 'Product URL is required'
      }, { status: 400 });
    }

    // REQUIRED authentication for website creation
    const user = await authenticateUser(request);
    
    if (!user) {
      return NextResponse.json({
        error: 'Authentication required',
        message: 'Please log in to create websites',
        requiresAuth: true
      }, { status: 401 });
    }

    console.log('🔍 CREATE DEBUG: Authenticated user:', {
      id: user.userId,
      email: user.email,
      plan: user.plan,
      websitesCreated: user.websitesCreated,
      limit: user.websiteLimit
    });

    // Check website creation limits
    if (!canCreateWebsite(user)) {
      return NextResponse.json({
        error: 'Website limit reached',
        message: `You have reached your ${user.plan} plan limit of ${user.websiteLimit} websites`,
        currentCount: user.websitesCreated,
        limit: user.websiteLimit,
        plan: user.plan,
        upgradeUrl: '/pricing',
        requiresUpgrade: true
      }, { status: 403 });
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(productUrl);
    } catch {
      return NextResponse.json({
        error: 'Invalid product URL format'
      }, { status: 400 });
    }

    console.log('🔍 CREATE DEBUG: Starting website generation for:', url.hostname);

    // Simulate website generation (replace with actual AI generation logic)
    const websiteData = {
      id: new ObjectId().toString(),
      productUrl,
      domain: url.hostname,
      niche: niche || 'General',
      targetAudience: targetAudience || 'General audience',
      customization: customization || {},
      
      // Generated content (mock data)
      title: `Amazing ${niche || 'Product'} - Best Deals Online`,
      description: `Discover the best ${niche || 'products'} for ${targetAudience || 'everyone'}. Quality guaranteed!`,
      
      content: {
        hero: {
          headline: `Transform Your Life with ${niche || 'Our Product'}`,
          subheadline: `Perfect for ${targetAudience || 'everyone who wants quality'}`,
          ctaText: 'Get Yours Now'
        },
        features: [
          'Premium Quality Materials',
          'Fast & Free Shipping',
          '30-Day Money Back Guarantee',
          '24/7 Customer Support'
        ],
        testimonials: [
          {
            name: 'Sarah Johnson',
            text: 'This product changed my life! Highly recommended.',
            rating: 5
          },
          {
            name: 'Mike Chen',
            text: 'Excellent quality and fast delivery. Will buy again!',
            rating: 5
          }
        ]
      },
      
      // User and creation info
      createdBy: user.userId,
      createdAt: new Date().toISOString(),
      userPlan: user.plan,
      status: 'generated'
    };

    // Update user's website count in database
    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(user.userId) },
      { 
        $inc: { websitesCreated: 1 },
        $set: { lastWebsiteCreated: new Date() }
      }
    );

    // Save website data (optional - for user dashboard)
    await db.collection('websites').insertOne({
      ...websiteData,
      userId: new ObjectId(user.userId)
    });

    console.log('🔍 CREATE DEBUG: Website generated successfully, user count updated');

    return NextResponse.json({
      success: true,
      website: websiteData,
      message: `Website created successfully! You have used ${user.websitesCreated + 1} of ${user.websiteLimit === -1 ? 'unlimited' : user.websiteLimit} websites.`,
      userStats: {
        websitesCreated: user.websitesCreated + 1,
        websiteLimit: user.websiteLimit,
        plan: user.plan
      }
    });

  } catch (error) {
    console.error('🔍 CREATE ERROR:', error);
    return NextResponse.json({
      error: 'Failed to generate website',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

