// src/app/api/ai/generate-website/route.ts
// RESTORED OLD FUNCTIONALITY + OBJECTID AUTHENTICATION - Perfect combination!

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { connectToDatabase } from '@/lib/mongodb';
import { authenticateUser, canCreateWebsite } from '@/lib/auth-middleware';
import { ObjectId } from 'mongodb';
import { z } from 'zod';

// Request validation schema
const generateWebsiteSchema = z.object({
  productUrl: z.string().url('Invalid URL format'),
  niche: z.string().optional(),
  targetAudience: z.string().optional(),
  customization: z.object({
    colorScheme: z.string().optional(),
    style: z.string().optional(),
    tone: z.string().optional(),
  }).optional(),
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Parse request body
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers }
      );
    }

    // Validate request data
    const validationResult = generateWebsiteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400, headers }
      );
    }

    const { productUrl, niche, targetAudience, customization } = validationResult.data;

    // OBJECTID AUTHENTICATION (NEW SYSTEM)
    const user = await authenticateUser(request);
    
    if (!user) {
      return NextResponse.json(
        { 
          error: 'Authentication required',
          message: 'Please log in to create websites',
          requiresAuth: true
        },
        { status: 401, headers }
      );
    }

    console.log('🔍 CREATE DEBUG: Authenticated user:', {
      id: user.userId,
      email: user.email,
      plan: user.plan,
      websitesCreated: user.websitesCreated,
      limit: user.websiteLimit
    });

    // Check website creation limits using ObjectID system
    if (!canCreateWebsite(user)) {
      return NextResponse.json(
        {
          error: 'Website limit reached',
          message: `You have reached your ${user.plan} plan limit of ${user.websiteLimit} websites`,
          currentCount: user.websitesCreated,
          limit: user.websiteLimit,
          plan: user.plan,
          upgradeUrl: '/pricing',
          requiresUpgrade: true,
          upgradeRequired: true // Backward compatibility
        },
        { status: 403, headers }
      );
    }

    // Generate website using Gemini AI (ORIGINAL FUNCTIONALITY)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
Create a professional affiliate marketing website for the following product:
Product URL: ${productUrl}
Niche: ${niche || 'Auto-detect from URL'}
Target Audience: ${targetAudience || 'General consumers'}
Style Preferences: ${JSON.stringify(customization || {})}

Generate a complete, conversion-optimized affiliate website with:

1. COMPELLING HEADLINE that grabs attention
2. PRODUCT BENEFITS section highlighting key features
3. SOCIAL PROOF with testimonials and reviews
4. CLEAR CALL-TO-ACTION buttons
5. URGENCY/SCARCITY elements
6. RESPONSIVE HTML/CSS design
7. SEO-optimized content
8. Professional styling with modern design

Return ONLY a JSON object with this structure:
{
  "title": "Website title",
  "headline": "Main headline",
  "description": "Meta description",
  "html": "Complete HTML code",
  "css": "Complete CSS code",
  "features": ["feature1", "feature2", "feature3"],
  "cta": "Call to action text",
  "seoKeywords": ["keyword1", "keyword2", "keyword3"]
}

Make it professional, conversion-focused, and ready to generate sales!
`;

    let aiResponse;
    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      aiResponse = response.text();
    } catch (error) {
      console.error('Gemini AI Error:', error);
      return NextResponse.json(
        {
          error: 'AI generation failed',
          message: 'Unable to generate website content. Please try again.'
        },
        { status: 500, headers }
      );
    }

    // Parse AI response (ORIGINAL FUNCTIONALITY)
    let websiteData;
    try {
      // Clean the response (remove markdown formatting if present)
      const cleanResponse = aiResponse.replace(/```json\n?|\n?```/g, '').trim();
      websiteData = JSON.parse(cleanResponse);
    } catch (error) {
      console.error('AI Response Parse Error:', error);
      return NextResponse.json(
        {
          error: 'AI response parsing failed',
          message: 'Generated content could not be processed. Please try again.'
        },
        { status: 500, headers }
      );
    }

    // Connect to database for saving (OBJECTID SYSTEM)
    const { db } = await connectToDatabase();

    // Save website to database (ORIGINAL FUNCTIONALITY + OBJECTID)
    const website = {
      userId: new ObjectId(user.userId), // ObjectID instead of JWT userId
      productUrl: productUrl,
      title: websiteData.title,
      headline: websiteData.headline,
      description: websiteData.description,
      html: websiteData.html,
      css: websiteData.css,
      features: websiteData.features || [],
      cta: websiteData.cta,
      seoKeywords: websiteData.seoKeywords || [],
      niche: niche,
      targetAudience: targetAudience,
      customization: customization,
      createdAt: new Date(),
      isActive: true,
      analytics: {
        views: 0,
        clicks: 0,
        conversions: 0,
        revenue: 0
      },
      // Additional ObjectID system fields
      createdBy: user.userId,
      userPlan: user.plan,
      status: 'generated'
    };

    const websiteResult = await db.collection('websites').insertOne(website);

    // Update user's website count (OBJECTID SYSTEM)
    await db.collection('users').updateOne(
      { _id: new ObjectId(user.userId) },
      {
        $inc: { websitesCreated: 1 },
        $set: { 
          lastActivity: new Date(),
          lastWebsiteCreated: new Date()
        }
      }
    );

    console.log('🔍 CREATE DEBUG: Website generated successfully, user count updated');

    // Return success response (ORIGINAL FUNCTIONALITY + OBJECTID)
    return NextResponse.json(
      {
        success: true,
        message: `Website generated successfully! You have used ${user.websitesCreated + 1} of ${user.websiteLimit === -1 ? 'unlimited' : user.websiteLimit} websites.`,
        website: {
          id: websiteResult.insertedId.toString(),
          title: websiteData.title,
          headline: websiteData.headline,
          description: websiteData.description,
          html: websiteData.html,
          css: websiteData.css,
          features: websiteData.features,
          cta: websiteData.cta,
          seoKeywords: websiteData.seoKeywords,
          productUrl: productUrl,
          createdAt: website.createdAt
        },
        userStats: {
          websitesCreated: user.websitesCreated + 1,
          websiteLimit: user.websiteLimit,
          remainingWebsites: user.websiteLimit === -1 ? -1 : user.websiteLimit - (user.websitesCreated + 1),
          plan: user.plan
        }
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('🔍 CREATE ERROR:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: 'An unexpected error occurred. Please try again.'
      },
      { status: 500, headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      }}
    );
  }
}

// Handle OPTIONS request for CORS (ORIGINAL FUNCTIONALITY)
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
