// app/api/stripe/route.ts
// COMPLETE FIXED VERSION - All ObjectId and property errors resolved

import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../../../lib/mongodb';
import { authenticateUser } from '../../../lib/auth-middleware';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-06-20',
});

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

    const { priceId, successUrl, cancelUrl } = body;

    if (!priceId) {
      return NextResponse.json(
        { error: 'Price ID is required' },
        { status: 400, headers }
      );
    }

    // Connect to database
    const { db } = await connectToDatabase();

    // Check if user already has a Stripe customer
    const existingCustomer = await db.collection('users').findOne({ 
      _id: new ObjectId(user.userId) // FIXED: Use ObjectId constructor
    });

    let stripeCustomer;

    if (existingCustomer?.stripeCustomerId) {
      // Retrieve existing Stripe customer
      stripeCustomer = await stripe.customers.retrieve(existingCustomer.stripeCustomerId.toString());
    } else {
      // Create or retrieve Stripe customer
      let stripeCustomer;
      
      stripeCustomer = await stripe.customers.create({
        email: user.email,
        name: user.name, // FIXED: Use 'name' instead of 'fullName'
        metadata: {
          userId: user.userId.toString(),
          plan: 'plan'
        }
      });

      if (existingCustomer?.stripeCustomerId) {
        stripeCustomer = await stripe.customers.retrieve(existingCustomer.stripeCustomerId.toString());
      }

      // Update user with Stripe customer ID
      await db.collection('users').updateOne(
        { _id: new ObjectId(user.userId) }, // FIXED: Use ObjectId constructor
        { 
          $set: { 
            stripeCustomerId: stripeCustomer.id,
            updatedAt: new Date()
          }
        }
      );
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomer.id,
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?success=true`,
      cancel_url: cancelUrl || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?canceled=true`,
      metadata: {
        userId: user.userId,
        priceId: priceId,
      },
      subscription_data: {
        metadata: {
          userId: user.userId,
          priceId: priceId,
        },
      },
    });

    // Log the checkout session creation
    console.log('Stripe checkout session created:', {
      sessionId: session.id,
      userId: user.userId,
      priceId: priceId,
      customerId: stripeCustomer.id
    });

    return NextResponse.json(
      {
        success: true,
        sessionId: session.id,
        url: session.url,
        message: 'Checkout session created successfully'
      },
      { status: 200, headers }
    );

  } catch (error) {
    console.error('Stripe checkout error:', error);
    
    return NextResponse.json(
      { 
        error: 'Payment processing failed',
        message: 'Unable to create checkout session. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      },
      { 
        status: 500, 
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        }
      }
    );
  }
}

// Handle webhook events
export async function PUT(request: NextRequest) {
  try {
    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    if (!sig) {
      return NextResponse.json(
        { error: 'Missing Stripe signature' },
        { status: 400 }
      );
    }

    let event;

    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      return NextResponse.json(
        { error: 'Webhook signature verification failed' },
        { status: 400 }
      );
    }

    // Handle the event
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('Checkout session completed:', session.id);
        
        // Update user subscription status
        if (session.metadata?.userId) {
          const { db } = await connectToDatabase();
          await db.collection('users').updateOne(
            { _id: new ObjectId(session.metadata.userId) }, // FIXED: Use ObjectId constructor
            {
              $set: {
                subscriptionStatus: 'active',
                stripeSessionId: session.id,
                updatedAt: new Date()
              }
            }
          );
        }
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = event.data.object;
        console.log('Subscription updated:', subscription.id);
        
        // Update user subscription status
        if (subscription.metadata?.userId) {
          const { db } = await connectToDatabase();
          await db.collection('users').updateOne(
            { _id: new ObjectId(subscription.metadata.userId) }, // FIXED: Use ObjectId constructor
            {
              $set: {
                subscriptionStatus: subscription.status,
                updatedAt: new Date()
              }
            }
          );
        }
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, stripe-signature',
    },
  });
}
