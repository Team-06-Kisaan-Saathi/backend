// Test setup file
process.env.NODE_ENV = 'test';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.MONGODB_URI = 'mongodb://localhost:27017/test-db';
process.env.PORT = 5001;
process.env.BCRYPT_SALT_ROUNDS = 10;

// Increase timeout for database operations
jest.setTimeout(10000);
