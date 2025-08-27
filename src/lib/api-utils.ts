// lib/api-utils.ts
// API UTILITIES - Consistent error handling and CORS

import { NextResponse } from 'next/server';

// CORS headers for all API responses
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

// Success response helper
export function createSuccessResponse(data: any, status: number = 200) {
  return NextResponse.json(
    {
      success: true,
      ...data
    },
    { 
      status,
      headers: corsHeaders
    }
  );
}

// Error response helper
export function createErrorResponse(
  error: string, 
  message?: string, 
  status: number = 400,
  additionalData?: any
) {
  return NextResponse.json(
    {
      success: false,
      error,
      message: message || error,
      ...additionalData
    },
    { 
      status,
      headers: corsHeaders
    }
  );
}

// Validation error response
export function createValidationErrorResponse(errors: any[]) {
  return NextResponse.json(
    {
      success: false,
      error: 'Validation failed',
      message: 'Please check your input and try again',
      details: errors
    },
    { 
      status: 400,
      headers: corsHeaders
    }
  );
}

// Authentication error response
export function createAuthErrorResponse(message: string = 'Authentication required') {
  return NextResponse.json(
    {
      success: false,
      error: 'Authentication failed',
      message,
      requiresAuth: true
    },
    { 
      status: 401,
      headers: corsHeaders
    }
  );
}

// Rate limit error response
export function createRateLimitErrorResponse(message: string = 'Rate limit exceeded') {
  return NextResponse.json(
    {
      success: false,
      error: 'Rate limit exceeded',
      message,
      retryAfter: 60
    },
    { 
      status: 429,
      headers: {
        ...corsHeaders,
        'Retry-After': '60'
      }
    }
  );
}

// Server error response
export function createServerErrorResponse(message: string = 'Internal server error') {
  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      message
    },
    { 
      status: 500,
      headers: corsHeaders
    }
  );
}

// OPTIONS handler for CORS preflight
export function handleCorsOptions() {
  return new NextResponse(null, {
    status: 200,
    headers: corsHeaders,
  });
}

// Parse JSON body with error handling
export async function parseJsonBody(request: Request) {
  try {
    return await request.json();
  } catch (error) {
    throw new Error('Invalid JSON in request body');
  }
}

// Validate required fields
export function validateRequiredFields(data: any, requiredFields: string[]) {
  const missingFields = requiredFields.filter(field => {
    const value = data[field];
    return value === undefined || value === null || value === '';
  });

  if (missingFields.length > 0) {
    throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
  }
}

// Validate URL format
export function validateUrl(url: string, fieldName: string = 'URL') {
  try {
    new URL(url);
    return true;
  } catch {
    throw new Error(`${fieldName} must be a valid URL`);
  }
}

// Sanitize string input
export function sanitizeString(input: string, maxLength: number = 1000) {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    .trim()
    .substring(0, maxLength)
    .replace(/[<>]/g, ''); // Basic XSS prevention
}

// Rate limiting helper (simple in-memory store)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(
  identifier: string, 
  maxRequests: number = 10, 
  windowMs: number = 60000
): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  
  // Clean up old entries
  for (const entry of Array.from(rateLimitStore.entries())) {
  const [key, value] = entry;
    if (value.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
  
  const current = rateLimitStore.get(identifier);
  
  if (!current) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.resetTime < now) {
    rateLimitStore.set(identifier, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (current.count >= maxRequests) {
    return false;
  }
  
  current.count++;
  return true;
}
