/**
 * End-to-End Tests
 * 
 * Tests complete user journeys with:
 * - Clear step execution
 * - Expected vs Actual output comparison
 */

const request = require('supertest');
const mongoose = require('mongoose');

describe('End-to-End Tests - User Journeys', () => {
    let app;
    let testPhone;

    beforeAll(async () => {
        app = require('../../src/app');
        testPhone = `99${Date.now().toString().slice(-8)}`; // Unique phone

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
    });

    afterAll(async () => {
        // Cleanup test data
        const User = require('../../src/models/User');
        await User.deleteMany({ phone: testPhone });

        if (mongoose.connection.readyState !== 0) {
            await mongoose.connection.close();
        }
    });

    describe('Farmer Registration Flow - E2E', () => {
        test('Step 1: Send OTP - Expected vs Actual', async () => {
            // STEP 1: Send OTP Request
            console.log('\n=== STEP 1: Send OTP ===');

            const input = { phone: testPhone };
            console.log('Input:', JSON.stringify(input));

            const expectedOutput = {
                success: true,
                message: expect.any(String)
            };
            console.log('Expected Output Structure:', expectedOutput);

            // Execute
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send(input);

            const actualOutput = response.body;
            console.log('Actual Output:', JSON.stringify(actualOutput));
            console.log('Response Status:', response.status);

            // Verify Expected vs Actual
            expect(response.status).toBe(200); // Expected: 200, Actual: response.status
            expect(actualOutput).toHaveProperty('success'); // Expected: has 'success', Actual: verified
            expect(actualOutput).toHaveProperty('message'); // Expected: has 'message', Actual: verified

            console.log('✅ Step 1 Complete: Expected matches Actual');
        });

        test('Step 2: Login with OTP - Expected vs Actual', async () => {
            // Setup: First send OTP
            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            // STEP 2: Login
            console.log('\n=== STEP 2: Login with OTP ===');

            // Get the OTP from database (in real scenario, user would receive it)
            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: testPhone });

            const input = {
                phone: testPhone,
                otp: user.otp
            };
            console.log('Input:', JSON.stringify({ phone: input.phone, otp: '******' }));

            const expectedOutput = {
                success: true,
                token: expect.any(String),
                user: {
                    id: expect.any(String),
                    phone: testPhone,
                    role: expect.any(String)
                }
            };
            console.log('Expected Output Structure:', expectedOutput);

            // Execute
            const response = await request(app)
                .post('/api/auth/login')
                .send(input);

            const actualOutput = response.body;
            console.log('Actual Output:', JSON.stringify({
                ...actualOutput,
                token: actualOutput.token ? 'JWT_TOKEN' : undefined
            }));

            // Verify Expected vs Actual
            expect(response.status).toBe(200);
            expect(actualOutput.success).toBe(true); // Expected: true, Actual: verified
            expect(actualOutput).toHaveProperty('token'); // Expected: JWT token, Actual: present
            expect(actualOutput).toHaveProperty('user'); // Expected: user object, Actual: present

            console.log('✅ Step 2 Complete: Expected matches Actual');
        });
    });

    describe('Complete API Flow - Expected vs Actual Tracking', () => {
        let authToken;

        test('Flow Step 1: Registration - Track Expected vs Actual', async () => {
            const newPhone = `88${Date.now().toString().slice(-8)}`;

            const input = {
                phone: newPhone,
                name: 'Test Farmer',
                role: 'farmer'
            };

            const expected = {
                status: 201,
                body: {
                    success: true,
                    user: expect.objectContaining({
                        phone: newPhone,
                        name: 'Test Farmer',
                        role: 'farmer'
                    })
                }
            };

            const response = await request(app)
                .post('/api/auth/register')
                .send(input);

            // Expected vs Actual Comparison
            const comparison = {
                status: {
                    expected: expected.status,
                    actual: response.status,
                    match: response.status === expected.status
                },
                success: {
                    expected: true,
                    actual: response.body.success,
                    match: response.body.success === true
                }
            };

            console.log('Expected vs Actual Comparison:', comparison);

            expect(comparison.status.match).toBe(true);
            expect(comparison.success.match).toBe(true);

            // Cleanup
            const User = require('../../src/models/User');
            await User.deleteOne({ phone: newPhone });
        });

        test('Flow Step 2: Authentication - Verify Complete Journey', async () => {
            // This test verifies the complete journey works
            const journeyPhone = `77${Date.now().toString().slice(-8)}`;

            // Step 1: Send OTP
            const step1Response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: journeyPhone });

            expect(step1Response.body.success).toBe(true);

            // Step 2: Get OTP and Login
            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: journeyPhone });

            const step2Response = await request(app)
                .post('/api/auth/login')
                .send({ phone: journeyPhone, otp: user.otp });

            expect(step2Response.body.success).toBe(true);
            expect(step2Response.body.token).toBeDefined();

            // Cleanup
            await User.deleteOne({ phone: journeyPhone });

            console.log('✅ Complete journey verified with expected outputs');
        });
    });

    describe('Error Scenarios - Expected vs Actual', () => {
        test('Invalid Phone - Expected Error vs Actual Error', async () => {
            const input = { phone: 'invalid' };

            const expected = {
                status: 400,
                body: {
                    success: false,
                    message: expect.any(String)
                }
            };

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send(input);

            const actual = {
                status: response.status,
                body: response.body
            };

            console.log('Expected Error:', expected);
            console.log('Actual Error:', actual);

            expect(actual.status).toBeGreaterThanOrEqual(400);
            expect(actual.body.success).toBe(false);

            console.log('✅ Error handling: Expected matches Actual');
        });
    });
});
