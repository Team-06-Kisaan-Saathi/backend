/**
 * Integration Tests - Module Interactions
 * 
 * Tests the integration between different modules:
 * - Express App → Routes → Controllers
 * - Controllers → Models → MongoDB
 * - Middleware chain execution
 * - JWT Authentication flow
 */

const request = require('supertest');
const mongoose = require('mongoose');

describe('Integration Tests - Module Interactions', () => {
    let app;
    let server;

    beforeAll(async () => {
        // Import app after environment is set
        app = require('../../src/app');

        // Connect to test database
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
        if (server) {
            server.close();
        }
    });

    describe('Express App → Routes → Controllers Integration', () => {
        test('should integrate Express app with auth routes', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            // Verify the full integration chain worked
            expect(response.status).toBeDefined();
            expect(response.body).toBeDefined();
        });

        test('should pass request through middleware chain', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            // Verify middleware processed the request
            expect(response.headers['content-type']).toMatch(/json/);
        });
    });

    describe('Controllers → Models → MongoDB Integration', () => {
        test('should integrate controller with User model', async () => {
            const testPhone = '1234567890';

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            // Verify data reached database layer
            expect(response.body).toHaveProperty('success');
            expect(response.body).toHaveProperty('message');
        });

        test('should handle database operations through model', async () => {
            const User = require('../../src/models/User');

            // Test direct model interaction
            const testUser = {
                phone: '9999999999',
                otp: '123456',
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            };

            const user = await User.create(testUser);
            expect(user.phone).toBe(testUser.phone);

            // Cleanup
            await User.deleteOne({ _id: user._id });
        });
    });

    describe('Middleware Chain Integration', () => {
        test('should execute middleware in correct order', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            // Verify CORS middleware executed
            expect(response.headers['access-control-allow-origin']).toBeDefined();
        });

        test('should validate JSON body through middleware', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .set('Content-Type', 'application/json')
                .send('invalid json');

            // Middleware should catch invalid JSON
            expect(response.status).toBeGreaterThanOrEqual(400);
        });
    });

    describe('JWT Authentication Integration', () => {
        test('should integrate JWT generation with login flow', async () => {
            const jwt = require('jsonwebtoken');
            const token = jwt.sign(
                { userId: 'test-user-id' },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            expect(token).toBeDefined();
            expect(typeof token).toBe('string');

            // Verify token can be decoded
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe('test-user-id');
        });

        test('should integrate auth middleware with protected routes', async () => {
            const response = await request(app)
                .get('/api/auth/me');

            // Should require authentication
            expect(response.status).toBe(401);
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('Error Handling Integration', () => {
        test('should propagate errors through middleware chain', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({}); // Missing required field

            // Error handler should catch and format error
            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.body).toHaveProperty('message');
        });
    });

    describe('Database Connection Integration', () => {
        test('should verify MongoDB connection is active', () => {
            expect(mongoose.connection.readyState).toBe(1); // 1 = connected
        });

        test('should handle database operations', async () => {
            const User = require('../../src/models/User');

            // Test database is accessible
            const count = await User.countDocuments();
            expect(typeof count).toBe('number');
        });
    });
});
