// app/api/ai/analyze-website/route.ts
// COMPLETE FIXED VERSION - Puppeteer Chrome configuration resolved

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../../lib/mongodb';
import { authenticateUser } from '../../../../lib/auth-middleware';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // Authenticate user
    const user = await authenticateUser(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401, headers }
      );
    }

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

    const { url, analysisType = 'comprehensive' } = body;

    if (!url) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400, headers }
      );
    }

    // Validate URL format
    let websiteUrl;
    try {
      websiteUrl = new URL(url);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400, headers }
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Check user's plan and usage limits
    const userProfile = await db.collection('users').findOne(
      { _id: new ObjectId(user.userId) },
      { projection: { password: 0 } }
    );

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404, headers }
      );
    }

    // Check analysis limits based on plan
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    const analysisCount = await db.collection('analyses').countDocuments({
      userId: new ObjectId(user.userId),
      createdAt: { $gte: new Date(currentMonth + '-01') }
    });

    const limits = {
      basic: 5,
      pro: 25,
      enterprise: -1 // unlimited
    };

    const userLimit = limits[userProfile.plan] || limits.basic;
    if (userLimit !== -1 && analysisCount >= userLimit) {
      return NextResponse.json(
        { 
          error: 'Analysis limit reached',
          message: `You have reached your monthly limit of ${userLimit} analyses. Upgrade your plan for more analyses.`,
          currentUsage: analysisCount,
          limit: userLimit
        },
        { status: 429, headers }
      );
    }

    let browser;
    try {
      // Launch Puppeteer with proper Chrome configuration
      browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-first-run',
          '--no-zygote',
          '--single-process'
        ],
        timeout: 30000
      });

      const page = await browser.newPage();
      
      // Set user agent and viewport
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the website with timeout
      console.log(`Analyzing website: ${websiteUrl.href}`);
      await page.goto(websiteUrl.href, { 
        waitUntil: 'networkidle2', 
        timeout: 30000 
      });

      // Wait for page to load completely
      await page.waitForTimeout(3000);

      // Get performance metrics
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        };
      });

      // Get page content and structure
      const pageAnalysis = await page.evaluate(() => {
        const title = document.title;
        const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
        const headings = {
          h1: Array.from(document.querySelectorAll('h1')).map(h => h.textContent?.trim()).filter(Boolean),
          h2: Array.from(document.querySelectorAll('h2')).map(h => h.textContent?.trim()).filter(Boolean),
          h3: Array.from(document.querySelectorAll('h3')).map(h => h.textContent?.trim()).filter(Boolean),
        };
        
        const images = Array.from(document.querySelectorAll('img')).map(img => ({
          src: img.src,
          alt: img.alt,
          hasAlt: Boolean(img.alt)
        }));

        const links = Array.from(document.querySelectorAll('a')).map(link => ({
          href: link.href,
          text: link.textContent?.trim(),
          isExternal: link.hostname !== window.location.hostname
        }));

        return {
          title,
          metaDescription,
          headings,
          images,
          links,
          wordCount: document.body.textContent?.split(/\s+/).length || 0,
          hasSchema: Boolean(document.querySelector('script[type="application/ld+json"]')),
          mobileViewport: Boolean(document.querySelector('meta[name="viewport"]')),
        };
      });

      await browser.close();

      // Generate AI analysis using Gemini
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
      
      const analysisPrompt = `
        Analyze this website data and provide comprehensive insights:
        
        URL: ${websiteUrl.href}
        Title: ${pageAnalysis.title}
        Meta Description: ${pageAnalysis.metaDescription}
        
        Performance Metrics:
        - Load Time: ${performanceMetrics.loadTime}ms
        - DOM Content Loaded: ${performanceMetrics.domContentLoaded}ms
        - First Paint: ${performanceMetrics.firstPaint}ms
        - First Contentful Paint: ${performanceMetrics.firstContentfulPaint}ms
        
        Content Structure:
        - H1 Tags: ${pageAnalysis.headings.h1.length} (${pageAnalysis.headings.h1.join(', ')})
        - H2 Tags: ${pageAnalysis.headings.h2.length}
        - H3 Tags: ${pageAnalysis.headings.h3.length}
        - Images: ${pageAnalysis.images.length} (${pageAnalysis.images.filter(img => !img.hasAlt).length} missing alt text)
        - Links: ${pageAnalysis.links.length} (${pageAnalysis.links.filter(link => link.isExternal).length} external)
        - Word Count: ${pageAnalysis.wordCount}
        - Has Schema: ${pageAnalysis.hasSchema}
        - Mobile Viewport: ${pageAnalysis.mobileViewport}
        
        Please provide:
        1. Performance Analysis (score out of 100)
        2. SEO Analysis (score out of 100)
        3. Content Quality Analysis (score out of 100)
        4. User Experience Analysis (score out of 100)
        5. Specific recommendations for improvement
        6. Overall score and summary
        
        Format the response as detailed JSON with scores, analysis, and actionable recommendations.
      `;

      const result = await model.generateContent(analysisPrompt);
      const aiAnalysis = result.response.text();

      // Save analysis to database
      const analysisRecord = {
        userId: new ObjectId(user.userId),
        url: websiteUrl.href,
        analysisType,
        performanceMetrics,
        pageAnalysis,
        aiAnalysis,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      const insertResult = await db.collection('analyses').insertOne(analysisRecord);

      // Update user's analysis count
      await db.collection('users').updateOne(
        { _id: new ObjectId(user.userId) },
        { 
          $inc: { analysesCreated: 1 },
          $set: { updatedAt: new Date() }
        }
      );

      return NextResponse.json({
        success: true,
        analysisId: insertResult.insertedId,
        analysis: {
          url: websiteUrl.href,
          performance: performanceMetrics,
          content: pageAnalysis,
          aiInsights: aiAnalysis,
          createdAt: analysisRecord.createdAt
        },
        usage: {
          current: analysisCount + 1,
          limit: userLimit === -1 ? 'unlimited' : userLimit,
          remaining: userLimit === -1 ? 'unlimited' : Math.max(0, userLimit - analysisCount - 1)
        }
      }, { status: 200, headers });

    } catch (puppeteerError) {
      console.error('Puppeteer error:', puppeteerError);
      
      if (browser) {
        await browser.close();
      }

      return NextResponse.json({
        error: 'Website analysis failed',
        message: 'Unable to access the website. Please check the URL and try again.',
        details: puppeteerError.message
      }, { status: 500, headers });
    }

  } catch (error) {
    console.error('Analysis error:', error);
    
    return NextResponse.json({
      error: 'Analysis processing failed',
      message: 'An error occurred while analyzing the website. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }, { 
      status: 500, 
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
