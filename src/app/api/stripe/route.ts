import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { connectToDatabase } from '../../../lib/mongodb';
import { withErrorHandler, ErrorFactory, ValidationHelper } from '../../../lib/error-handler';
import { rateLimit } from '../../../lib/rate-limit';
import { EnvironmentConfig } from '../../../lib/environment';
import { authenticateRequest } from '../../../lib/auth-middleware';
import { ObjectId } from 'mongodb';

// Initialize Stripe with production configuration
const stripe = new Stripe(EnvironmentConfig.stripe.secretKey, {
  apiVersion: '2023-10-16',
  typescript: true,
  telemetry: false,
  maxNetworkRetries: 3,
});

// Subscription plan configuration
const SUBSCRIPTION_PLANS = {
  pro: {
    priceId: EnvironmentConfig.stripe.proPriceId,
    name: 'Pro Plan',
    features: ['Unlimited websites', '100 AI requests/day', 'Priority support'],
    limits: {
      websites: 20,
      aiRequests: 100,
      apiCalls: 1000
    }
  },
  enterprise: {
    priceId: EnvironmentConfig.stripe.enterprisePriceId,
    name: 'Enterprise Plan',
    features: ['Unlimited everything', '1000 AI requests/day', 'Dedicated support'],
    limits: {
      websites: 100,
      aiRequests: 1000,
      apiCalls: 10000
    }
  }
} as const;

// Create checkout session
async function createCheckoutSession(request: NextRequest): Promise<NextResponse> {
  // Rate limiting for payment endpoints
  const rateLimitResult = await rateLimit(request, 'payment');
  if (!rateLimitResult.success) {
    throw ErrorFactory.rateLimit('Too many payment attempts. Please try again later.');
  }
  
  // Authenticate user
  const user = await authenticateRequest(request);
  if (!user) {
    throw ErrorFactory.authentication('Authentication required for checkout');
  }
  
  const body = await request.json();
  
  // Validate request body
  ValidationHelper.validateRequired(body.plan, 'plan');
  ValidationHelper.validateEnum(body.plan, ['pro', 'enterprise'], 'plan');
  
  const plan = body.plan as keyof typeof SUBSCRIPTION_PLANS;
  const planConfig = SUBSCRIPTION_PLANS[plan];
  
  try {
    const { db } = await connectToDatabase();
    
    // Check if user already has an active subscription
    const existingSubscription = await db.collection('subscriptions').findOne({
      userId: user.userId,
      status: { $in: ['active', 'trialing'] }
    });
    
    if (existingSubscription) {
      throw ErrorFactory.validation('User already has an active subscription');
    }
    
    // Create or retrieve Stripe customer
    let stripeCustomer;
    const existingCustomer = await db.collection('users').findOne({ _id: user.userId });
    
    if (existingCustomer?.stripeCustomerId) {
      stripeCustomer = await stripe.customers.retrieve(existingCustomer.stripeCustomerId.toString());
    } else {
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: user.fullName,
        metadata: {
          userId: user.userId.toString(),
          plan: plan
        }
      });
      
      // Update user with Stripe customer ID
      await db.collection('users').updateOne(
        { _id: user.userId },
        { 
          $set: { 
            stripeCustomerId: stripeCustomer.id,
            updatedAt: new Date()
          }
        }
      );
    }
    
    // Create simplified checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: planConfig.priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${EnvironmentConfig.app.url}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${EnvironmentConfig.app.url}/pricing?cancelled=true`,
      metadata: {
        userId: user.userId.toString(),
        plan: plan,
        userEmail: user.email
      },
      subscription_data: {
        metadata: {
          userId: user.userId.toString(),
          plan: plan
        }
      }
    });
    
    // Log checkout session creation
    await db.collection('payment_logs').insertOne({
      userId: user.userId,
      action: 'checkout_session_created',
      sessionId: session.id,
      plan: plan,
      amount: session.amount_total,
      currency: session.currency,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: {
        sessionId: session.id,
        url: session.url,
        plan: planConfig
      }
    });
    
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw ErrorFactory.payment(`Payment processing failed: ${error.message}`, error.payment_intent?.id);
    }
    throw error;
  }
}

// Get subscription status
async function getSubscriptionStatus(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    throw ErrorFactory.authentication();
  }
  
  try {
    const { db } = await connectToDatabase();
    
    // Get user's subscription from database
    const subscription = await db.collection('subscriptions').findOne({
      userId: user.userId
    });
    
    if (!subscription) {
      return NextResponse.json({
        success: true,
        data: {
          plan: 'free',
          status: 'active',
          features: ['3 websites/day', '10 AI requests/day', 'Basic support']
        }
      });
    }
    
    // If we have a Stripe subscription ID, get latest status from Stripe
    if (subscription.stripeSubscriptionId) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      // Update local subscription status if different
      if (stripeSubscription.status !== subscription.status) {
        await db.collection('subscriptions').updateOne(
          { _id: subscription._id },
          { 
            $set: { 
              status: stripeSubscription.status,
              currentPeriodEnd: new Date(stripeSubscription.current_period_end * 1000),
              updatedAt: new Date()
            }
          }
        );
        subscription.status = stripeSubscription.status;
      }
      
      const planConfig = SUBSCRIPTION_PLANS[subscription.plan as keyof typeof SUBSCRIPTION_PLANS];
      
      return NextResponse.json({
        success: true,
        data: {
          plan: subscription.plan,
          status: subscription.status,
          currentPeriodEnd: stripeSubscription.current_period_end * 1000,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          features: planConfig?.features || [],
          limits: planConfig?.limits || {}
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: subscription
    });
    
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw ErrorFactory.externalAPI('stripe', `Failed to retrieve subscription: ${error.message}`);
    }
    throw error;
  }
}

// Cancel subscription
async function cancelSubscription(request: NextRequest): Promise<NextResponse> {
  const user = await authenticateRequest(request);
  if (!user) {
    throw ErrorFactory.authentication();
  }
  
  const body = await request.json();
  const cancelImmediately = body.immediate === true;
  
  try {
    const { db } = await connectToDatabase();
    
    // Get user's subscription
    const subscription = await db.collection('subscriptions').findOne({
      userId: user.userId,
      status: { $in: ['active', 'trialing'] }
    });
    
    if (!subscription || !subscription.stripeSubscriptionId) {
      throw ErrorFactory.notFound('Active subscription');
    }
    
    // Cancel subscription in Stripe
    const stripeSubscription = cancelImmediately
      ? await stripe.subscriptions.cancel(subscription.stripeSubscriptionId)
      : await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
          cancel_at_period_end: true
        });
    
    // Update local subscription
    await db.collection('subscriptions').updateOne(
      { _id: subscription._id },
      { 
        $set: { 
          status: stripeSubscription.status,
          cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
          canceledAt: cancelImmediately ? new Date() : null,
          updatedAt: new Date()
        }
      }
    );
    
    // Log cancellation
    await db.collection('payment_logs').insertOne({
      userId: user.userId,
      action: 'subscription_cancelled',
      subscriptionId: subscription.stripeSubscriptionId,
      immediate: cancelImmediately,
      createdAt: new Date()
    });
    
    return NextResponse.json({
      success: true,
      data: {
        status: stripeSubscription.status,
        cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
        currentPeriodEnd: stripeSubscription.current_period_end * 1000
      }
    });
    
  } catch (error) {
    if (error instanceof Stripe.errors.StripeError) {
      throw ErrorFactory.payment(`Failed to cancel subscription: ${error.message}`);
    }
    throw error;
  }
}

// Main route handler
async function handleStripeRequest(request: NextRequest): Promise<NextResponse> {
  const method = request.method;
  const url = new URL(request.url);
  const action = url.searchParams.get('action');
  
  switch (method) {
    case 'POST':
      if (action === 'create-checkout-session') {
        return createCheckoutSession(request);
      } else if (action === 'cancel-subscription') {
        return cancelSubscription(request);
      } else {
        throw ErrorFactory.validation('Invalid action parameter');
      }
      
    case 'GET':
      if (action === 'subscription-status') {
        return getSubscriptionStatus(request);
      } else {
        throw ErrorFactory.validation('Invalid action parameter');
      }
      
    default:
      throw ErrorFactory.validation(`Method ${method} not allowed`);
  }
}

// Export handlers with error handling
export const POST = withErrorHandler(handleStripeRequest);
export const GET = withErrorHandler(handleStripeRequest);
