/**
 * Regression Tests
 * 
 * Compares current functionality with baseline:
 * - What worked before
 * - What still works after changes
 */

const request = require('supertest');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

describe('Regression Tests - Before vs After Comparison', () => {
    let app;
    const baselinePath = path.join(__dirname, 'baseline-snapshot.json');
    let baseline;

    beforeAll(async () => {
        app = require('../../src/app');

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }

        // Load baseline (what worked before)
        if (fs.existsSync(baselinePath)) {
            baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
        } else {
            baseline = {
                version: '1.0.0',
                endpoints: {},
                created: new Date().toISOString()
            };
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }

        // Save current state as new baseline
        fs.writeFileSync(baselinePath, JSON.stringify(baseline, null, 2));
    });

    describe('API Contract Regression - What Worked Before', () => {
        test('POST /api/auth/send-otp - Verify response structure unchanged', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            const currentStructure = {
                status: response.status,
                hasSuccess: response.body.hasOwnProperty('success'),
                hasMessage: response.body.hasOwnProperty('message'),
                contentType: response.headers['content-type']
            };

            // What worked before (baseline)
            const beforeStructure = baseline.endpoints['/api/auth/send-otp'] || currentStructure;

            // What still works after changes
            expect(currentStructure.hasSuccess).toBe(beforeStructure.hasSuccess);
            expect(currentStructure.hasMessage).toBe(beforeStructure.hasMessage);
            expect(currentStructure.contentType).toContain('json');

            console.log('Before:', beforeStructure);
            console.log('After:', currentStructure);
            console.log('✅ API contract maintained');

            // Update baseline
            baseline.endpoints['/api/auth/send-otp'] = currentStructure;
        });

        test('POST /api/auth/login - Verify token generation unchanged', async () => {
            // Setup: Create test user with OTP
            const testPhone = `99${Date.now().toString().slice(-8)}`;
            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: testPhone });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ phone: testPhone, otp: user.otp });

            const currentStructure = {
                hasToken: response.body.hasOwnProperty('token'),
                hasUser: response.body.hasOwnProperty('user'),
                tokenType: typeof response.body.token
            };

            const beforeStructure = baseline.endpoints['/api/auth/login'] || currentStructure;

            // Regression check
            expect(currentStructure.hasToken).toBe(beforeStructure.hasToken);
            expect(currentStructure.hasUser).toBe(beforeStructure.hasUser);

            console.log('Login Before:', beforeStructure);
            console.log('Login After:', currentStructure);
            console.log('✅ Login functionality maintained');

            baseline.endpoints['/api/auth/login'] = currentStructure;

            // Cleanup
            await User.deleteOne({ phone: testPhone });
        });
    });

    describe('Database Schema Regression', () => {
        test('User model - Verify schema unchanged', () => {
            const User = require('../../src/models/User');
            const schema = User.schema.obj;

            const currentSchema = {
                hasPhone: schema.hasOwnProperty('phone'),
                hasOtp: schema.hasOwnProperty('otp'),
                hasOtpExpiry: schema.hasOwnProperty('otpExpiry'),
                hasPassword: schema.hasOwnProperty('password'),
                hasRole: schema.hasOwnProperty('role')
            };

            const beforeSchema = baseline.schemas?.User || currentSchema;

            // What worked before
            expect(currentSchema.hasPhone).toBe(beforeSchema.hasPhone);
            expect(currentSchema.hasOtp).toBe(beforeSchema.hasOtp);

            console.log('Schema Before:', beforeSchema);
            console.log('Schema After:', currentSchema);
            console.log('✅ Database schema maintained');

            if (!baseline.schemas) baseline.schemas = {};
            baseline.schemas.User = currentSchema;
        });
    });

    describe('Authentication Regression - What Still Works', () => {
        test('JWT generation - Verify still works after changes', () => {
            const jwt = require('jsonwebtoken');

            // What worked before (and should still work)
            const token = jwt.sign(
                { userId: 'test123' },
                process.env.JWT_SECRET,
                { expiresIn: '30d' }
            );

            // Verify functionality maintained
            expect(token).toBeDefined();

            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            expect(decoded.userId).toBe('test123');

            console.log('✅ JWT generation still works');
        });

        test('Auth middleware - Verify still protects routes', async () => {
            // What worked before: Protected routes require auth
            const response = await request(app)
                .get('/api/auth/me');

            // Should still work the same way
            expect(response.status).toBe(401);

            console.log('✅ Auth middleware still protects routes');
        });
    });

    describe('Error Handling Regression', () => {
        test('Invalid input handling - Verify unchanged', async () => {
            const beforeBehavior = {
                returnsError: true,
                returns400or500: true
            };

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({}); // Missing phone

            const afterBehavior = {
                returnsError: response.status >= 400,
                returns400or500: response.status >= 400 && response.status < 600
            };

            // What worked before should still work
            expect(afterBehavior.returnsError).toBe(beforeBehavior.returnsError);
            expect(afterBehavior.returns400or500).toBe(beforeBehavior.returns400or500);

            console.log('Error Handling Before:', beforeBehavior);
            console.log('Error Handling After:', afterBehavior);
            console.log('✅ Error handling unchanged');
        });
    });

    describe('Performance Regression', () => {
        test('Response time - Verify not degraded', async () => {
            const startTime = Date.now();

            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            const responseTime = Date.now() - startTime;

            const beforePerf = baseline.performance?.sendOtp || 2000;

            // Performance should not degrade significantly
            expect(responseTime).toBeLessThan(beforePerf * 2); // Allow 2x tolerance

            console.log(`Before: ~${beforePerf}ms`);
            console.log(`After: ${responseTime}ms`);

            if (responseTime < beforePerf) {
                console.log('✅ Performance improved');
            } else {
                console.log('✅ Performance maintained');
            }

            if (!baseline.performance) baseline.performance = {};
            baseline.performance.sendOtp = Math.min(responseTime, beforePerf);
        });
    });
});
