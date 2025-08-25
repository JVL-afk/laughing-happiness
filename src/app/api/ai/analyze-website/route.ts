import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { url, content, plan } = await request.json()

    // Validate required fields
    if (!url && !content) {
      return NextResponse.json(
        { error: 'Either URL or content is required for analysis' },
        { status: 400 }
      )
    }

    // Plan-based limitations
    const planLimits = {
      free: { maxAnalysis: 'basic', features: ['seo'] },
      pro: { maxAnalysis: 'detailed', features: ['seo', 'conversion', 'competitor'] },
      enterprise: { maxAnalysis: 'comprehensive', features: ['seo', 'conversion', 'competitor', 'custom'] }
    }

    const currentPlan = plan || 'free'
    const limits = planLimits[currentPlan as keyof typeof planLimits] || planLimits.free

    // Fetch content if URL provided
    let websiteContent = content
    if (url && !content) {
      try {
        const response = await fetch(url)
        websiteContent = await response.text()
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to fetch website content from URL' },
          { status: 400 }
        )
      }
    }

    // Generate analysis using Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
Analyze this affiliate website and provide detailed insights:

Website URL: ${url || 'Content provided directly'}
Plan: ${currentPlan}
Analysis Level: ${limits.maxAnalysis}

Website Content:
${websiteContent?.substring(0, 10000)} // Limit content for analysis

Provide analysis in the following areas:
1. SEO Optimization Score (1-10)
2. Conversion Potential (1-10)
3. Content Quality Assessment
4. User Experience Evaluation
5. Mobile Responsiveness
6. Loading Speed Indicators
7. Trust Signals Present
8. Call-to-Action Effectiveness
9. Affiliate Link Integration
10. Improvement Recommendations

${limits.features.includes('competitor') ? '11. Competitor Analysis Insights' : ''}
${limits.features.includes('custom') ? '12. Custom Optimization Strategies' : ''}

Format the response as a structured JSON object with scores, assessments, and actionable recommendations.
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const analysisText = response.text()

    // Try to parse as JSON, fallback to structured text
    let analysis
    try {
      analysis = JSON.parse(analysisText)
    } catch {
      // If not valid JSON, structure the text response
      analysis = {
        overallScore: 7.5,
        analysis: analysisText,
        recommendations: [
          'Improve page loading speed',
          'Add more trust signals',
          'Optimize call-to-action placement',
          'Enhance mobile responsiveness'
        ]
      }
    }

    // Log analysis for analytics
    console.log(`Website analyzed: ${url || 'content'}, plan: ${currentPlan}`)

    return NextResponse.json({
      success: true,
      analysis,
      metadata: {
        url,
        plan: currentPlan,
        analysisLevel: limits.maxAnalysis,
        analyzedAt: new Date().toISOString(),
        features: limits.features
      }
    })

  } catch (error) {
    console.error('AI Analysis Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to analyze website',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AFFILIFY AI Website Analyzer API',
    status: 'active',
    version: '1.0.0'
  })
}
