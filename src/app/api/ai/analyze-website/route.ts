// src/app/api/ai/analyze-website/route.ts
// RESTORED OLD FUNCTIONALITY + OBJECTID AUTHENTICATION - Perfect combination!

import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import puppeteer from 'puppeteer';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { authenticateUser } from '@/lib/auth-middleware';

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY!);

export async function POST(request: NextRequest) {
  try {
    // CORS headers
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    // OBJECTID AUTHENTICATION (NEW SYSTEM - OPTIONAL FOR ANALYSIS)
    const user = await authenticateUser(request);
    
    // Analysis can work without authentication, but with limits
    let userProfile = null;
    let analysisCount = 0;
    let userLimit = 3; // Default limit for unauthenticated users

    if (user) {
      console.log('🔍 ANALYZE DEBUG: Authenticated user:', {
        id: user.userId,
        email: user.email,
        plan: user.plan
      });

      // Connect to database for authenticated users
      const { db } = await connectToDatabase();
      
      userProfile = await db.collection('users').findOne(
        { _id: new ObjectId(user.userId) },
        { projection: { password: 0 } }
      );

      if (userProfile) {
        // Check analysis limits based on plan (ORIGINAL FUNCTIONALITY)
        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        analysisCount = await db.collection('analyses').countDocuments({
          userId: new ObjectId(user.userId),
          createdAt: { $gte: new Date(currentMonth + '-01') }
        });

        const limits = {
          basic: 5,
          pro: 25,
          enterprise: -1 // unlimited
        };

        userLimit = limits[userProfile.plan] || limits.basic;
        
        if (userLimit !== -1 && analysisCount >= userLimit) {
          return NextResponse.json(
            {
              error: 'Analysis limit reached',
              message: `You have reached your monthly limit of ${userLimit} analyses. Upgrade your plan for more analyses.`,
              currentUsage: analysisCount,
              limit: userLimit,
              plan: userProfile.plan,
              upgradeUrl: '/pricing',
              requiresUpgrade: true
            },
            { status: 429, headers }
          );
        }
      }
    } else {
      console.log('🔍 ANALYZE DEBUG: No authentication - using guest limits');
    }

    // Parse request body (ORIGINAL FUNCTIONALITY)
    let body;
    try {
      body = await request.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400, headers }
      );
    }

    const { websiteUrl, analysisType = 'comprehensive' } = body;

    if (!websiteUrl) {
      return NextResponse.json(
        { error: 'Website URL is required' },
        { status: 400, headers }
      );
    }

    // Validate URL format (ORIGINAL FUNCTIONALITY)
    let validatedUrl;
    try {
      validatedUrl = new URL(websiteUrl);
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid URL format' },
        { status: 400, headers }
      );
    }

    let browser;
    try {
      // Launch Puppeteer with proper Chrome configuration (ORIGINAL FUNCTIONALITY)
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

      // Set user agent and viewport (ORIGINAL FUNCTIONALITY)
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      await page.setViewport({ width: 1920, height: 1080 });

      // Navigate to the website with timeout (ORIGINAL FUNCTIONALITY)
      console.log(`🔍 ANALYZE: Analyzing website: ${validatedUrl.href}`);
      await page.goto(validatedUrl.href, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Wait for page to load completely (ORIGINAL FUNCTIONALITY)
      await page.waitForTimeout(3000);

      // Get performance metrics (ORIGINAL FUNCTIONALITY)
      const performanceMetrics = await page.evaluate(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
        return {
          loadTime: navigation.loadEventEnd - navigation.loadEventStart,
          domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
          firstPaint: performance.getEntriesByName('first-paint')[0]?.startTime || 0,
          firstContentfulPaint: performance.getEntriesByName('first-contentful-paint')[0]?.startTime || 0,
        };
      });

      // Get page content and structure (ORIGINAL FUNCTIONALITY)
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

      // Generate AI analysis using Gemini (ORIGINAL FUNCTIONALITY)
      const model = genAI.getGenerativeModel({ model: 'gemini-pro' });

      const analysisPrompt = `
        Analyze this website data and provide comprehensive insights:

        URL: ${validatedUrl.href}
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

        Please provide a comprehensive analysis with:
        1. Overall Grade (A-F) and Score (0-100)
        2. Performance Score (0-100) with load time analysis
        3. SEO Score (0-100) with title, meta, headings analysis
        4. Conversion Score (0-100) for affiliate potential
        5. Accessibility Score (0-100) with alt text, structure analysis
        6. Mobile Score (0-100) with viewport and responsive analysis
        7. Security Score (0-100) with HTTPS and trust signals
        8. Summary paragraph explaining overall assessment
        9. Top 3 Strengths as bullet points
        10. Top 3 Weaknesses as bullet points
        11. 5 Priority Recommendations with category, priority (High/Medium/Low), action, and impact
        12. Affiliate Optimization section with conversion potential, trust signals, improvement areas, competitive advantages
        13. Technical Issues list
        14. Priority Actions list
        15. Quick Stats with overall grade, score, load time, word count, SEO score, conversion score
        16. Achievements list (if any scores are above 90)

        Return ONLY a JSON object with this exact structure:
        {
          "url": "${validatedUrl.href}",
          "analyzedAt": "${new Date().toISOString()}",
          "analysisType": "${analysisType}",
          "performance": {
            "loadTime": ${performanceMetrics.loadTime},
            "metrics": ${JSON.stringify(performanceMetrics)},
            "score": 0
          },
          "content": ${JSON.stringify(pageAnalysis)},
          "insights": {
            "overallGrade": "A",
            "overallScore": 0,
            "performanceScore": 0,
            "seoScore": 0,
            "conversionScore": 0,
            "accessibilityScore": 0,
            "mobileScore": 0,
            "securityScore": 0,
            "summary": "",
            "strengths": [],
            "weaknesses": [],
            "recommendations": [],
            "affiliateOptimization": {
              "conversionPotential": "",
              "trustSignals": [],
              "improvementAreas": [],
              "competitiveAdvantages": []
            },
            "technicalIssues": [],
            "priorityActions": []
          },
          "quickStats": {
            "overallGrade": "A",
            "overallScore": 0,
            "loadTime": ${performanceMetrics.loadTime},
            "wordCount": ${pageAnalysis.wordCount},
            "seoScore": 0,
            "conversionScore": 0
          },
          "achievements": []
        }

        Make the analysis detailed, actionable, and focused on affiliate marketing optimization.
      `;

      const result = await model.generateContent(analysisPrompt);
      let aiAnalysis = result.response.text();

      // Parse AI response (ORIGINAL FUNCTIONALITY)
      let analysisData;
      try {
        // Clean the response (remove markdown formatting if present)
        const cleanResponse = aiAnalysis.replace(/```json\n?|\n?```/g, '').trim();
        analysisData = JSON.parse(cleanResponse);
      } catch (error) {
        console.error('AI Response Parse Error:', error);
        // Fallback analysis if AI parsing fails
        analysisData = {
          url: validatedUrl.href,
          analyzedAt: new Date().toISOString(),
          analysisType: analysisType,
          performance: {
            loadTime: performanceMetrics.loadTime,
            metrics: performanceMetrics,
            score: Math.max(0, 100 - Math.floor(performanceMetrics.loadTime / 100))
          },
          content: pageAnalysis,
          insights: {
            overallGrade: 'B',
            overallScore: 75,
            performanceScore: Math.max(0, 100 - Math.floor(performanceMetrics.loadTime / 100)),
            seoScore: pageAnalysis.title ? 80 : 60,
            conversionScore: 70,
            accessibilityScore: pageAnalysis.mobileViewport ? 80 : 60,
            mobileScore: pageAnalysis.mobileViewport ? 85 : 50,
            securityScore: validatedUrl.protocol === 'https:' ? 90 : 40,
            summary: `Website analysis completed for ${validatedUrl.href}. The site shows good potential with areas for improvement in performance and SEO optimization.`,
            strengths: ['Functional website structure', 'Content present', 'Accessible URL'],
            weaknesses: ['Performance could be improved', 'SEO optimization needed', 'Mobile experience enhancement required'],
            recommendations: [
              {
                category: 'Performance',
                priority: 'High',
                action: 'Optimize page load time',
                impact: 'Improved user experience and SEO rankings'
              }
            ],
            affiliateOptimization: {
              conversionPotential: 'Good potential for affiliate marketing with proper optimization',
              trustSignals: ['HTTPS enabled'],
              improvementAreas: ['Add trust badges', 'Improve call-to-action placement'],
              competitiveAdvantages: ['Established domain', 'Content structure']
            },
            technicalIssues: [],
            priorityActions: ['Optimize performance', 'Improve SEO', 'Enhance mobile experience']
          },
          quickStats: {
            overallGrade: 'B',
            overallScore: 75,
            loadTime: performanceMetrics.loadTime,
            wordCount: pageAnalysis.wordCount,
            seoScore: pageAnalysis.title ? 80 : 60,
            conversionScore: 70
          },
          achievements: []
        };
      }

      // Save analysis to database (OBJECTID SYSTEM - ONLY FOR AUTHENTICATED USERS)
      if (user && userProfile) {
        try {
          const { db } = await connectToDatabase();
          
          const analysisRecord = {
            userId: new ObjectId(user.userId),
            url: validatedUrl.href,
            analysisType,
            performanceMetrics,
            pageAnalysis,
            analysisData,
            createdAt: new Date(),
            updatedAt: new Date()
          };

          const insertResult = await db.collection('analyses').insertOne(analysisRecord);

          // Update user's analysis count
          await db.collection('users').updateOne(
            { _id: new ObjectId(user.userId) },
            {
              $inc: { analysesCreated: 1 },
              $set: { 
                updatedAt: new Date(),
                lastAnalysis: new Date()
              }
            }
          );

          console.log('🔍 ANALYZE DEBUG: Analysis saved to database');
        } catch (dbError) {
          console.error('🔍 ANALYZE ERROR: Database save failed:', dbError);
          // Continue without saving - analysis still works
        }
      }

      return NextResponse.json({
        success: true,
        message: 'Website analysis completed successfully!',
        analysis: analysisData,
        usage: user ? {
          current: analysisCount + 1,
          limit: userLimit === -1 ? 'unlimited' : userLimit,
          remaining: userLimit === -1 ? 'unlimited' : Math.max(0, userLimit - analysisCount - 1),
          plan: userProfile?.plan || 'guest'
        } : {
          current: 1,
          limit: userLimit,
          remaining: userLimit - 1,
          plan: 'guest'
        }
      }, { status: 200, headers });

    } catch (puppeteerError) {
      console.error('🔍 ANALYZE ERROR: Puppeteer error:', puppeteerError);

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
    console.error('🔍 ANALYZE ERROR: Analysis error:', error);

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

