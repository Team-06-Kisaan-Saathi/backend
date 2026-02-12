/**
 * Functional Tests - Test Case Results
 * 
 * Tests individual functions and endpoints:
 * - Detailed test case results for each function
 * - Pass/Fail status clearly documented
 */

const request = require('supertest');
const mongoose = require('mongoose');

describe('Functional Tests - Test Case Results', () => {
    let app;

    beforeAll(async () => {
        app = require('../../src/app');

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    describe('Test Case Suite: Send OTP Functionality', () => {
        test('TC001: Send OTP with valid 10-digit phone number - SHOULD PASS', async () => {
            const testCase = {
                id: 'TC001',
                description: 'Send OTP with valid phone',
                input: { phone: '9876543210' },
                expectedStatus: 200,
                expectedSuccess: true
            };

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                input: testCase.input,
                expectedStatus: testCase.expectedStatus,
                actualStatus: response.status,
                expectedSuccess: testCase.expectedSuccess,
                actualSuccess: response.body.success,
                passed: response.status === 200 && response.body.success === true
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');
            console.log('Details:', result);

            expect(result.passed).toBe(true);
        });

        test('TC002: Send OTP with invalid phone (less than 10 digits) - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC002',
                description: 'Send OTP with short phone',
                input: { phone: '12345' },
                expectedStatus: 400,
                expectedSuccess: false
            };

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                input: testCase.input,
                expectedBehavior: 'Reject invalid phone',
                actualStatus: response.status,
                actualSuccess: response.body.success,
                passed: response.status >= 400 && response.body.success === false
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });

        test('TC003: Send OTP with empty phone - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC003',
                description: 'Send OTP with no phone',
                input: {},
                expectedStatus: 400,
                expectedSuccess: false
            };

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                passed: response.status >= 400
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });
    });

    describe('Test Case Suite: Login Functionality', () => {
        let testPhone;
        let testOtp;

        beforeEach(async () => {
            // Setup: Create user with OTP
            testPhone = `99${Date.now().toString().slice(-8)}`;
            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: testPhone });
            testOtp = user.otp;
        });

        afterEach(async () => {
            // Cleanup
            const User = require('../../src/models/User');
            await User.deleteMany({ phone: testPhone });
        });

        test('TC101: Login with correct OTP - SHOULD PASS', async () => {
            const testCase = {
                id: 'TC101',
                description: 'Login with valid OTP',
                input: { phone: testPhone, otp: testOtp }
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                expectedToken: true,
                hasToken: !!response.body.token,
                expectedUser: true,
                hasUser: !!response.body.user,
                passed: response.status === 200 && !!response.body.token && !!response.body.user
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');
            console.log('Token Present:', result.hasToken);
            console.log('User Present:', result.hasUser);

            expect(result.passed).toBe(true);
        });

        test('TC102: Login with wrong OTP - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC102',
                description: 'Login with incorrect OTP',
                input: { phone: testPhone, otp: '000000' }
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                expectedBehavior: 'Reject wrong OTP',
                actualStatus: response.status,
                passed: response.status === 401 || response.status === 400
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });

        test('TC103: Login without phone - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC103',
                description: 'Login missing phone',
                input: { otp: testOtp }
            };

            const response = await request(app)
                .post('/api/auth/login')
                .send(testCase.input);

            const result = {
                testCase: testCase.id,
                passed: response.status >= 400
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });
    });

    describe('Test Case Suite: Protected Routes', () => {
        test('TC201: Access protected route without token - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC201',
                description: 'Access /me without auth',
                endpoint: '/api/auth/me',
                expectedStatus: 401
            };

            const response = await request(app)
                .get(testCase.endpoint);

            const result = {
                testCase: testCase.id,
                expectedStatus: 401,
                actualStatus: response.status,
                passed: response.status === 401
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });

        test('TC202: Access protected route with invalid token - SHOULD FAIL', async () => {
            const testCase = {
                id: 'TC202',
                description: 'Access /me with bad token',
                endpoint: '/api/auth/me',
                token: 'invalid-token',
                expectedStatus: 401
            };

            const response = await request(app)
                .get(testCase.endpoint)
                .set('Authorization', `Bearer ${testCase.token}`);

            const result = {
                testCase: testCase.id,
                passed: response.status === 401
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);
        });
    });

    describe('Test Case Suite: Database Operations', () => {
        test('TC301: Create user in database - SHOULD PASS', async () => {
            const User = require('../../src/models/User');

            const testCase = {
                id: 'TC301',
                description: 'Create user document',
                data: {
                    phone: `88${Date.now().toString().slice(-8)}`,
                    otp: '123456',
                    otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
                }
            };

            const user = await User.create(testCase.data);

            const result = {
                testCase: testCase.id,
                expectedId: true,
                hasId: !!user._id,
                expectedPhone: testCase.data.phone,
                actualPhone: user.phone,
                passed: !!user._id && user.phone === testCase.data.phone
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);

            // Cleanup
            await User.deleteOne({ _id: user._id });
        });

        test('TC302: Find user by phone - SHOULD PASS', async () => {
            const User = require('../../src/models/User');
            const testPhone = `77${Date.now().toString().slice(-8)}`;

            // Setup
            await User.create({
                phone: testPhone,
                otp: '123456',
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            });

            const testCase = {
                id: 'TC302',
                description: 'Query user by phone',
                query: { phone: testPhone }
            };

            const user = await User.findOne(testCase.query);

            const result = {
                testCase: testCase.id,
                expectedFound: true,
                actuallyFound: !!user,
                passed: !!user && user.phone === testPhone
            };

            console.log('Test Case:', testCase.id);
            console.log('Result:', result.passed ? '✅ PASS' : '❌ FAIL');

            expect(result.passed).toBe(true);

            // Cleanup
            await User.deleteOne({ phone: testPhone });
        });
    });
});
