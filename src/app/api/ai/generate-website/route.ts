import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: NextRequest) {
  try {
    const { product, description, targetAudience, plan } = await request.json()

    // Validate required fields
    if (!product || !description) {
      return NextResponse.json(
        { error: 'Product and description are required' },
        { status: 400 }
      )
    }

    // Plan-based limitations
    const planLimits = {
      free: { maxWords: 500, features: ['basic'] },
      pro: { maxWords: 2000, features: ['basic', 'seo', 'analytics'] },
      enterprise: { maxWords: 5000, features: ['basic', 'seo', 'analytics', 'custom'] }
    }

    const currentPlan = plan || 'free'
    const limits = planLimits[currentPlan as keyof typeof planLimits] || planLimits.free

    // Generate website content using Gemini AI
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
Create a professional affiliate website for the product: ${product}

Product Description: ${description}
Target Audience: ${targetAudience || 'General consumers'}
Plan: ${currentPlan}
Max Words: ${limits.maxWords}

Generate a complete HTML website with the following structure:
1. Header with navigation
2. Hero section with compelling headline
3. Product features and benefits
4. Social proof/testimonials
5. Call-to-action sections
6. Footer

Requirements:
- Professional, conversion-optimized design
- Mobile-responsive layout
- Include affiliate links (use placeholder: [AFFILIATE_LINK])
- Use modern CSS with gradients and animations
- Focus on conversion and user engagement
- Include trust signals and urgency elements
- SEO-optimized content
- Gaming-inspired design elements

Return only the complete HTML code with embedded CSS and JavaScript.
`

    const result = await model.generateContent(prompt)
    const response = await result.response
    const htmlContent = response.text()

    // Log generation for analytics
    console.log(`Website generated for product: ${product}, plan: ${currentPlan}`)

    return NextResponse.json({
      success: true,
      html: htmlContent,
      metadata: {
        product,
        description,
        targetAudience,
        plan: currentPlan,
        generatedAt: new Date().toISOString(),
        wordCount: htmlContent.split(' ').length
      }
    })

  } catch (error) {
    console.error('AI Generation Error:', error)
    
    return NextResponse.json(
      { 
        error: 'Failed to generate website',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'AFFILIFY AI Website Generator API',
    status: 'active',
    version: '1.0.0'
  })
}
