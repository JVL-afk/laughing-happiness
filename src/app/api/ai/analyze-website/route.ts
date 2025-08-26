// app/api/ai/analyze-website/route.ts
// FIXED VERSION - Resolves 400/500 errors with comprehensive analysis

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import * as cheerio from 'cheerio';
import { z } from 'zod';
import jwt from 'jsonwebtoken';

// Request validation schema
const analyzeWebsiteSchema = z.object({
  websiteUrl: z.string().url('Invalid URL format'),
  analysisType: z.enum(['basic', 'comprehensive', 'seo', 'performance']).optional().default('comprehensive'),
  includeCompetitorAnalysis: z.boolean().optional().default(false),
});

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

// Performance analysis function
async function analyzePerformance(url: string) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Start performance monitoring
    const startTime = Date.now();
    
    await page.goto(url, { 
      waitUntil: 'networkidle2',
      timeout: 30000 
    });
    
    const loadTime = Date.now() - startTime;
    
    // Get performance metrics
    const performanceMetrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      return {
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
        firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
        firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
      };
    });
    
    // Get page content for analysis
    const content = await page.content();
    
    await browser.close();
    
    return {
      loadTime,
      performanceMetrics,
      content,
      success: true
    };
    
  } catch (error) {
    if (browser) await browser.close();
    console.error('Performance analysis error:', error);
    return {
      loadTime: null,
      performanceMetrics: null,
      content: null,
      success: false,
      error: error.message
    };
  }
}

// Content analysis function using Cheerio
function analyzeContent(html: string, url: string) {
  const $ = cheerio.load(html);
  
  return {
    title: $('title').text() || 'No title found',
    metaDescription: $('meta[name="description"]').attr('content') || 'No meta description',
    headings: {
      h1: $('h1').map((i, el) => $(el).text()).get(),
      h2: $('h2').map((i, el) => $(el).text()).get(),
      h3: $('h3').map((i, el) => $(el).text()).get(),
    },
    images: $('img').map((i, el) => ({
      src: $(el).attr('src'),
      alt: $(el).attr('alt') || 'No alt text',
      title: $(el).attr('title') || ''
    })).get(),
    links: {
      internal: $('a[href^="/"], a[href^="' + url + '"]').length,
      external: $('a[href^="http"]:not([href^="' + url + '"])').length,
      total: $('a[href]').length
    },
    forms: $('form').length,
    scripts: $('script').length,
    stylesheets: $('link[rel="stylesheet"]').length,
    wordCount: $('body').text().split(/\s+/).filter(word => word.length > 0).length,
    hasStructuredData: $('script[type="application/ld+json"]').length > 0,
    socialMetaTags: {
      openGraph: $('meta[property^="og:"]').length,
      twitterCard: $('meta[name^="twitter:"]').length
    }
  };
}

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
    const validationResult = analyzeWebsiteSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Validation failed',
          details: validationResult.error.errors
        },
        { status: 400, headers }
      );
    }

    const { websiteUrl, analysisType, includeCompetitorAnalysis } = validationResult.data;

    // Optional authentication (for rate limiting)
    let userId = null;
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        userId = decoded.userId;
      } catch (error) {
        // Continue without authentication for free analysis
      }
    }

    // Perform performance analysis
    console.log('Starting performance analysis for:', websiteUrl);
    const performanceData = await analyzePerformance(websiteUrl);
    
    if (!performanceData.success) {
      return NextResponse.json(
        { 
          error: 'Website analysis failed',
          message: 'Unable to access the website. Please check the URL and try again.',
          details: performanceData.error
        },
        { status: 400, headers }
      );
    }

    // Analyze content structure
    console.log('Analyzing content structure...');
    const contentAnalysis = analyzeContent(performanceData.content!, websiteUrl);

    // Generate AI insights using Gemini
    console.log('Generating AI insights...');
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    const analysisPrompt = `
Analyze this website comprehensively and provide actionable insights:

URL: ${websiteUrl}
Analysis Type: ${analysisType}

PERFORMANCE DATA:
- Load Time: ${performanceData.loadTime}ms
- DOM Content Loaded: ${performanceData.performanceMetrics?.domContentLoaded}ms
- First Contentful Paint: ${performanceData.performanceMetrics?.firstContentfulPaint}ms

CONTENT ANALYSIS:
- Title: ${contentAnalysis.title}
- Meta Description: ${contentAnalysis.metaDescription}
- Word Count: ${contentAnalysis.wordCount}
- Images: ${contentAnalysis.images.length}
- Internal Links: ${contentAnalysis.links.internal}
- External Links: ${contentAnalysis.links.external}
- H1 Tags: ${contentAnalysis.headings.h1.length}
- H2 Tags: ${contentAnalysis.headings.h2.length}
- Forms: ${contentAnalysis.forms}
- Structured Data: ${contentAnalysis.hasStructuredData ? 'Yes' : 'No'}

Provide a comprehensive analysis with:

1. PERFORMANCE SCORE (0-100) with specific recommendations
2. SEO ANALYSIS with actionable improvements
3. CONVERSION OPTIMIZATION suggestions
4. ACCESSIBILITY ASSESSMENT
5. MOBILE RESPONSIVENESS evaluation
6. SECURITY CONSIDERATIONS
7. AFFILIATE MARKETING OPTIMIZATION tips
8. COMPETITIVE ADVANTAGES and weaknesses
9. PRIORITY ACTION ITEMS (top 5)
10. OVERALL GRADE (A-F) with explanation

Return ONLY a JSON object with this structure:
{
  "overallGrade": "A",
  "overallScore": 85,
  "performanceScore": 78,
  "seoScore": 82,
  "conversionScore": 88,
  "accessibilityScore": 75,
  "mobileScore": 90,
  "securityScore": 85,
  "summary": "Brief overall assessment",
  "strengths": ["strength1", "strength2", "strength3"],
  "weaknesses": ["weakness1", "weakness2", "weakness3"],
  "recommendations": [
    {
      "category": "Performance",
      "priority": "High",
      "action": "Specific action to take",
      "impact": "Expected improvement"
    }
  ],
  "affiliateOptimization": {
    "conversionPotential": "High/Medium/Low",
    "trustSignals": ["signal1", "signal2"],
    "improvementAreas": ["area1", "area2"],
    "competitiveAdvantages": ["advantage1", "advantage2"]
  },
  "technicalIssues": ["issue1", "issue2"],
  "priorityActions": ["action1", "action2", "action3", "action4", "action5"]
}

Be specific, actionable, and focus on affiliate marketing success!
`;

    let aiAnalysis;
    try {
      const result = await model.generateContent(analysisPrompt);
      const response = await result.response;
      const aiResponseText = response.text();
      
      // Clean and parse AI response
      const cleanResponse = aiResponseText.replace(/```json\n?|\n?```/g, '').trim();
      aiAnalysis = JSON.parse(cleanResponse);
    } catch (error) {
      console.error('AI Analysis Error:', error);
      return NextResponse.json(
        { 
          error: 'AI analysis failed',
          message: 'Unable to generate insights. Please try again.'
        },
        { status: 500, headers }
      );
    }

    // Compile final analysis report
    const analysisReport = {
      url: websiteUrl,
      analyzedAt: new Date().toISOString(),
      analysisType: analysisType,
      
      // Performance metrics
      performance: {
        loadTime: performanceData.loadTime,
        metrics: performanceData.performanceMetrics,
        score: aiAnalysis.performanceScore
      },
      
      // Content analysis
      content: contentAnalysis,
      
      // AI insights
      insights: aiAnalysis,
      
      // Quick stats for dashboard
      quickStats: {
        overallGrade: aiAnalysis.overallGrade,
        overallScore: aiAnalysis.overallScore,
        loadTime: performanceData.loadTime,
        wordCount: contentAnalysis.wordCount,
        seoScore: aiAnalysis.seoScore,
        conversionScore: aiAnalysis.conversionScore
      },
      
      // Gaming elements
      achievements: [],
      levelUp: false
    };

    // Add gaming achievements based on scores
    if (aiAnalysis.overallScore >= 90) {
      analysisReport.achievements.push('🏆 Website Excellence Master');
    }
    if (aiAnalysis.performanceScore >= 85) {
      analysisReport.achievements.push('⚡ Speed Demon');
    }
    if (aiAnalysis.seoScore >= 85) {
      analysisReport.achievements.push('🔍 SEO Wizard');
    }
    if (aiAnalysis.conversionScore >= 85) {
      analysisReport.achievements.push('💰 Conversion Champion');
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Website analysis completed successfully!',
        analysis: analysisReport
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Analyze Website Error:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'An unexpected error occurred during analysis. Please try again.'
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

