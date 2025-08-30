// src/app/api/ai/analyze-website/route.ts
// OBJECTID-BASED ANALYZE-WEBSITE - Optional Authentication

import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const { websiteUrl, analysisType } = await request.json();

    if (!websiteUrl) {
      return NextResponse.json({
        error: 'Website URL is required'
      }, { status: 400 });
    }

    // Optional authentication - analyze-website works without login
    const user = await authenticateUser(request);
    
    if (user) {
      console.log('🔍 ANALYZE DEBUG: Authenticated user:', {
        id: user.userId,
        email: user.email,
        plan: user.plan
      });
    } else {
      console.log('🔍 ANALYZE DEBUG: Anonymous analysis request');
    }

    // Validate URL format
    let url: URL;
    try {
      url = new URL(websiteUrl);
    } catch {
      return NextResponse.json({
        error: 'Invalid URL format'
      }, { status: 400 });
    }

    console.log('🔍 ANALYZE DEBUG: Starting analysis for:', url.hostname);

    // Simulate website analysis (replace with actual analysis logic)
    const analysisResult = {
      url: websiteUrl,
      domain: url.hostname,
      analysisType: analysisType || 'basic',
      timestamp: new Date().toISOString(),
      
      // Mock analysis results
      seoScore: Math.floor(Math.random() * 40) + 60, // 60-100
      performanceScore: Math.floor(Math.random() * 30) + 70, // 70-100
      
      recommendations: [
        'Optimize meta descriptions for better SEO',
        'Improve page loading speed',
        'Add more relevant keywords',
        'Enhance mobile responsiveness'
      ],
      
      keyInsights: {
        primaryTopic: 'E-commerce/Retail',
        targetAudience: 'Online shoppers',
        contentQuality: 'Good',
        competitorAnalysis: 'Moderate competition'
      },
      
      // User-specific data if authenticated
      ...(user && {
        analyzedBy: user.userId,
        userPlan: user.plan,
        analysisCount: (user.websitesCreated || 0) + 1
      })
    };

    console.log('🔍 ANALYZE DEBUG: Analysis completed successfully');

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      message: user ? 
        `Analysis completed for ${user.name}` : 
        'Analysis completed (anonymous)'
    });

  } catch (error) {
    console.error('🔍 ANALYZE ERROR:', error);
    return NextResponse.json({
      error: 'Failed to analyze website',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

