import { MongoClient, Db } from 'mongodb';

// New MongoDB URI - will be updated with working cluster
const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGODB_URI_NEW || 'mongodb+srv://JVLMANUS2:CEZARA@affilify.ofmdr9.mongodb.net/?retryWrites=true&w=majority&appName=AFFILIFY';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI or MONGODB_URI_NEW environment variable');
}

// Check if we're in build mode to prevent connection attempts
const isBuildTime = process.env.NODE_ENV === 'production' && !process.env.VERCEL && !process.env.NETLIFY;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Enhanced connection options for better reliability
const connectionOptions = {
  maxPoolSize: 10,
  serverSelectionTimeoutMS: 10000, // Increased timeout
  socketTimeoutMS: 45000,
  connectTimeoutMS: 10000,
  maxIdleTimeMS: 30000,
  retryWrites: true,
  // Add authentication source
  authSource: 'admin',
};

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable to preserve the connection
  if (!global._mongoClientPromise) {
    client = new MongoClient(MONGODB_URI, connectionOptions);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, create a new connection
  client = new MongoClient(MONGODB_URI, connectionOptions);
  clientPromise = client.connect();
}

export { clientPromise };
export default clientPromise;

// Enhanced connection function with better error handling
export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  // Skip connection during build time
  if (isBuildTime || process.env.SKIP_DB_CONNECTION === 'true') {
    console.log('⚠️ Skipping database connection during build time');
    throw new Error('Database connection skipped during build time');
  }

  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    const client = await clientPromise;
    const db = client.db('affilify');

    // Test the connection
    await db.admin().ping();
    console.log('✅ Successfully connected to MongoDB Atlas');

    return { client, db };
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);

    // Provide specific error messages
    if (error instanceof Error) {
      if (error.message.includes('authentication failed')) {
        console.error('🔐 Authentication failed - check username/password');
      } else if (error.message.includes('Server selection timed out')) {
        console.error('🌐 Network timeout - check network access and cluster status');
      } else if (error.message.includes('ENOTFOUND')) {
        console.error('🔍 DNS resolution failed - check cluster hostname');
      }
    }

    throw error;
  }
}

export async function getDatabase(): Promise<Db> {
  // Skip connection during build time
  if (isBuildTime || process.env.SKIP_DB_CONNECTION === 'true') {
    throw new Error('Database connection skipped during build time');
  }

  const client = await clientPromise;
  return client.db('affilify');
}

// Collection helper functions
export async function getUserCollection() {
  const db = await getDatabase();
  return db.collection('users');
}

export async function getWebsiteCollection() {
  const db = await getDatabase();
  return db.collection('websites');
}

export async function getAnalyticsCollection() {
  const db = await getDatabase();
  return db.collection('analytics');
}

// Database initialization function
export async function initializeDatabase() {
  try {
    const db = await getDatabase();

    // Create indexes for better performance
    const users = db.collection('users');
    await users.createIndex({ email: 1 }, { unique: true });
    await users.createIndex({ createdAt: 1 });

    const websites = db.collection('websites');
    await websites.createIndex({ userId: 1 });
    await websites.createIndex({ createdAt: 1 });

    const analytics = db.collection('analytics');
    await analytics.createIndex({ websiteId: 1 });
    await analytics.createIndex({ userId: 1 });
    await analytics.createIndex({ date: 1 });

    console.log('✅ Database indexes created successfully');

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  }
}

// Health check function
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const { db } = await connectToDatabase();
    await db.admin().ping();
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}

// Connection status function
export async function getDatabaseStatus() {
  try {
    const { client, db } = await connectToDatabase();
    const stats = await db.stats();

    return {
      connected: true,
      database: db.databaseName,
      collections: stats.collections,
      dataSize: stats.dataSize,
      indexSize: stats.indexSize,
      connectionString: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
    };
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      connectionString: MONGODB_URI.replace(/\/\/[^:]+:[^@]+@/, '//***:***@'), // Hide credentials
    };
  }
}
