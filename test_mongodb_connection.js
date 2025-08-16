const { MongoClient } = require('mongodb');

// Test MongoDB connection with the provided connection string
const MONGODB_URI = 'mongodb+srv://JVLMANUS2:CEZARA@affilify.ofmdr9.mongodb.net/?retryWrites=true&w=majority&appName=AFFILIFY';

async function testConnection() {
  console.log('🔄 Testing MongoDB connection...');
  console.log('Connection string:', MONGODB_URI);
  
  try {
    const client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    console.log('🔄 Attempting to connect...');
    await client.connect();
    console.log('✅ Successfully connected to MongoDB!');

    // Test database access
    const db = client.db('affilify');
    console.log('✅ Successfully accessed affilify database!');

    // Test collections
    const collections = await db.listCollections().toArray();
    console.log('📋 Available collections:', collections.map(c => c.name));

    // Test creating a test user
    const users = db.collection('users');
    const testUser = {
      fullName: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      plan: 'basic',
      createdAt: new Date(),
      isTest: true
    };

    console.log('🔄 Testing user creation...');
    const result = await users.insertOne(testUser);
    console.log('✅ Test user created with ID:', result.insertedId);

    // Clean up test user
    await users.deleteOne({ _id: result.insertedId });
    console.log('🧹 Test user cleaned up');

    await client.close();
    console.log('✅ Connection test completed successfully!');

  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    console.error('Full error:', error);
  }
}

testConnection();
