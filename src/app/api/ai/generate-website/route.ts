// app/api/ai/generate-website/route.ts
// FIXED VERSION - Resolves 400 Bad Request errors

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { connectToDatabase } from '@/lib/mongodb';
import jwt from 'jsonwebtoken';
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

    // Get user from JWT token
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

    const token = authHeader.substring(7);
    let userId;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
      userId = decoded.userId;
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401, headers }
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({ _id: userId });
    
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404, headers }
      );
    }

    // Check user's website limit
    if (user.websitesCreated >= user.websiteLimit) {
      return NextResponse.json(
        { 
          error: 'Website limit reached',
          message: `You have reached your limit of ${user.websiteLimit} websites. Please upgrade your plan.`,
          upgradeRequired: true
        },
        { status: 403, headers }
      );
    }

    // Generate website using Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

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

    // Parse AI response
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

    // Save website to database
    const website = {
      userId: userId,
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
      }
    };

    const websiteResult = await db.collection('websites').insertOne(website);

    // Update user's website count
    await db.collection('users').updateOne(
      { _id: userId },
      { 
        $inc: { websitesCreated: 1 },
        $set: { lastActivity: new Date() }
      }
    );

    // Return success response
    return NextResponse.json(
      {
        success: true,
        message: 'Website generated successfully!',
        website: {
          id: websiteResult.insertedId,
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
          remainingWebsites: user.websiteLimit - (user.websitesCreated + 1)
        }
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Generate Website Error:', error);
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

// Handle OPTIONS request for CORS
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
