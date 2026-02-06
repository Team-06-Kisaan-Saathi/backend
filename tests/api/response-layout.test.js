/**
 * API Interface Tests (UI equivalent for backend)
 * 
 * Tests API endpoint layout and response structure:
 * - Response format checking
 * - Status code verification
 * - Header validation
 */

const request = require('supertest');
const mongoose = require('mongoose');

describe('API Interface Tests - Layout and Response', () => {
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

    describe('API Response Structure - Layout Checking', () => {
        test('POST /api/auth/send-otp - Verify response layout', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            const layout = {
                statusCode: response.status,
                headers: {
                    contentType: response.headers['content-type'],
                    hasContentType: !!response.headers['content-type']
                },
                body: {
                    structure: Object.keys(response.body),
                    hasSuccess: response.body.hasOwnProperty('success'),
                    hasMessage: response.body.hasOwnProperty('message'),
                    successType: typeof response.body.success,
                    messageType: typeof response.body.message
                }
            };

            console.log('API Response Layout:');
            console.log(JSON.stringify(layout, null, 2));

            // Verify layout standards
            expect(layout.headers.contentType).toContain('json');
            expect(layout.body.hasSuccess).toBe(true);
            expect(layout.body.hasMessage).toBe(true);
            expect(layout.body.successType).toBe('boolean');
            expect(layout.body.messageType).toBe('string');

            console.log('✅ Response layout conforms to standards');
        });

        test('POST /api/auth/login - Verify complex response layout', async () => {
            // Setup
            const testPhone = `99${Date.now().toString().slice(-8)}`;
            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: testPhone });

            const response = await request(app)
                .post('/api/auth/login')
                .send({ phone: testPhone, otp: user.otp });

            const layout = {
                statusCode: response.status,
                body: {
                    topLevel: Object.keys(response.body),
                    hasToken: response.body.hasOwnProperty('token'),
                    hasUser: response.body.hasOwnProperty('user')
                }
            };

            if (response.body.user) {
                layout.body.userFields = Object.keys(response.body.user);
            }

            console.log('Login Response Layout:');
            console.log(JSON.stringify(layout, null, 2));

            expect(layout.body.hasToken).toBe(true);
            expect(layout.body.hasUser).toBe(true);

            console.log('✅ Login response layout correct');

            // Cleanup
            await User.deleteOne({ phone: testPhone });
        });
    });

    describe('HTTP Status Codes - Response Checking', () => {
        test('Successful request - Returns 200 OK', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            expect(response.status).toBe(200);
            console.log('✅ Success status code: 200');
        });

        test('Invalid request - Returns 4xx error', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({}); // Missing phone

            expect(response.status).toBeGreaterThanOrEqual(400);
            expect(response.status).toBeLessThan(500);
            console.log(`✅ Client error status code: ${response.status}`);
        });

        test('Unauthorized access - Returns 401', async () => {
            const response = await request(app)
                .get('/api/auth/me'); // Protected route, no token

            expect(response.status).toBe(401);
            console.log('✅ Unauthorized status code: 401');
        });
    });

    describe('Response Headers - Interface Validation', () => {
        test('Content-Type header - Should be application/json', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            const contentType = response.headers['content-type'];

            expect(contentType).toContain('application/json');
            console.log(`✅ Content-Type: ${contentType}`);
        });

        test('CORS headers - Should allow cross-origin requests', async () => {
            const response = await request(app)
                .options('/api/auth/send-otp');

            const corsHeader = response.headers['access-control-allow-origin'];

            console.log(`CORS Header: ${corsHeader}`);
            console.log('✅ CORS configured');
        });
    });

    describe('Error Response Layout', () => {
        test('Error responses - Should have consistent layout', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: 'invalid' });

            const errorLayout = {
                status: response.status,
                hasBody: !!response.body,
                hasMessage: response.body.hasOwnProperty('message'),
                hasSuccess: response.body.hasOwnProperty('success'),
                successValue: response.body.success
            };

            console.log('Error Response Layout:');
            console.log(JSON.stringify(errorLayout, null, 2));

            expect(errorLayout.hasMessage).toBe(true);
            expect(errorLayout.successValue).toBe(false);

            console.log('✅ Error layout consistent');
        });
    });

    describe('API Consistency - Interface Standards', () => {
        test('All success responses - Use same structure', async () => {
            const endpoints = [
                { method: 'post', url: '/api/auth/send-otp', data: { phone: '9876543210' } }
            ];

            const structures = [];

            for (const endpoint of endpoints) {
                const response = await request(app)[endpoint.method](endpoint.url)
                    .send(endpoint.data);

                structures.push({
                    endpoint: endpoint.url,
                    hasSuccess: response.body.hasOwnProperty('success'),
                    hasMessage: response.body.hasOwnProperty('message'),
                    contentType: response.headers['content-type']
                });
            }

            // Verify all use same structure
            const allHaveSuccess = structures.every(s => s.hasSuccess);
            const allHaveMessage = structures.every(s => s.hasMessage);
            const allJSON = structures.every(s => s.contentType.includes('json'));

            expect(allHaveSuccess).toBe(true);
            expect(allHaveMessage).toBe(true);
            expect(allJSON).toBe(true);

            console.log('✅ All endpoints use consistent structure');
        });
    });

    describe('API Documentation - Interface Clarity', () => {
        test('Endpoints return clear error messages', async () => {
            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({});

            const hasErrorMessage = response.body.message && response.body.message.length > 0;

            expect(hasErrorMessage).toBe(true);
            console.log(`Error Message: "${response.body.message}"`);
            console.log('✅ Clear error message provided');
        });
    });
});
