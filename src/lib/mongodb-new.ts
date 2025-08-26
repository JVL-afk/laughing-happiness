// lib/mongodb-new.ts
// MONGODB NEW - Includes all missing exports for backward compatibility

import { MongoClient, Db, Collection } from 'mongodb';

if (!process.env.MONGODB_URI) {
  throw new Error('Please add your MongoDB URI to .env.local');
}

const uri = process.env.MONGODB_URI;
const options = {
  useUnifiedTopology: true,
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  let globalWithMongo = global as typeof globalThis & {
    _mongoClientPromise?: Promise<MongoClient>;
  };

  if (!globalWithMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalWithMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalWithMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  try {
    const client = await clientPromise;
    const db = client.db('affilify');
    
    await db.admin().ping();
    
    return { client, db };
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw new Error('Failed to connect to database');
  }
}

// Get user collection
export async function getUserCollection(): Promise<Collection> {
  const { db } = await connectToDatabase();
  return db.collection('users');
}

// Get websites collection
export async function getWebsiteCollection(): Promise<Collection> {
  const { db } = await connectToDatabase();
  return db.collection('websites');
}

// Get analytics collection
export async function getAnalyticsCollection(): Promise<Collection> {
  const { db } = await connectToDatabase();
  return db.collection('analytics');
}

// Database health check
export async function getDatabaseStatus() {
  try {
    const { db } = await connectToDatabase();
    const result = await db.admin().ping();
    
    return {
      status: 'connected',
      ping: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Comprehensive database health check
export async function checkDatabaseHealth() {
  try {
    const { db } = await connectToDatabase();
    
    // Test basic connection
    await db.admin().ping();
    
    // Test collections
    const collections = await db.listCollections().toArray();
    const collectionNames = collections.map(c => c.name);
    
    // Test user collection
    const userCollection = db.collection('users');
    const userCount = await userCollection.countDocuments();
    
    // Test websites collection
    const websiteCollection = db.collection('websites');
    const websiteCount = await websiteCollection.countDocuments();
    
    return {
      status: 'healthy',
      collections: collectionNames,
      stats: {
        users: userCount,
        websites: websiteCount
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Helper function for database operations with error handling
export async function withDatabase<T>(
  operation: (db: Db) => Promise<T>
): Promise<T> {
  try {
    const { db } = await connectToDatabase();
    return await operation(db);
  } catch (error) {
    console.error('Database operation error:', error);
    throw error;
  }
}

export default clientPromise;
