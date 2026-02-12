/**
 * Performance Tests
 * 
 * Tests response time and data loading performance:
 * - API response time measurements
 * - Database query performance
 * - Load testing
 */

const request = require('supertest');
const mongoose = require('mongoose');

describe('Performance Tests - Response Time and Data Loading', () => {
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

    describe('API Response Time Tests', () => {
        test('POST /api/auth/send-otp - Response time should be < 2000ms', async () => {
            const startTime = Date.now();

            const response = await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: '9876543210' });

            const responseTime = Date.now() - startTime;

            const performance = {
                endpoint: '/api/auth/send-otp',
                responseTime: `${responseTime}ms`,
                threshold: '< 2000ms',
                passed: responseTime < 2000,
                grade: responseTime < 100 ? 'A+' :
                    responseTime < 500 ? 'A' :
                        responseTime < 1000 ? 'B' :
                            responseTime < 2000 ? 'C' : 'F'
            };

            console.log('Performance Test:');
            console.log(JSON.stringify(performance, null, 2));

            expect(response.status).toBeDefined();
            expect(responseTime).toBeLessThan(2000);

            console.log(`✅ Response Time: ${responseTime}ms (Grade: ${performance.grade})`);
        });

        test('POST /api/auth/login - Response time should be < 2000ms', async () => {
            // Setup
            const testPhone = `99${Date.now().toString().slice(-8)}`;
            await request(app)
                .post('/api/auth/send-otp')
                .send({ phone: testPhone });

            const User = require('../../src/models/User');
            const user = await User.findOne({ phone: testPhone });

            const startTime = Date.now();

            const response = await request(app)
                .post('/api/auth/login')
                .send({ phone: testPhone, otp: user.otp });

            const responseTime = Date.now() - startTime;

            expect(responseTime).toBeLessThan(2000);
            console.log(`✅ Login Response Time: ${responseTime}ms`);

            // Cleanup
            await User.deleteOne({ phone: testPhone });
        });
    });

    describe('Database Query Performance', () => {
        test('User.findOne() - Query time should be < 100ms', async () => {
            const User = require('../../src/models/User');

            // Setup test data
            const testPhone = `88${Date.now().toString().slice(-8)}`;
            await User.create({
                phone: testPhone,
                otp: '123456',
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            });

            const startTime = Date.now();

            const user = await User.findOne({ phone: testPhone });

            const queryTime = Date.now() - startTime;

            const performance = {
                operation: 'User.findOne()',
                queryTime: `${queryTime}ms`,
                threshold: '< 100ms',
                passed: queryTime < 100
            };

            console.log('Database Performance:');
            console.log(JSON.stringify(performance, null, 2));

            expect(user).toBeDefined();
            expect(queryTime).toBeLessThan(100);

            console.log(`✅ Query Time: ${queryTime}ms`);

            // Cleanup
            await User.deleteOne({ phone: testPhone });
        });

        test('User.create() - Insert time should be < 200ms', async () => {
            const User = require('../../src/models/User');
            const testPhone = `77${Date.now().toString().slice(-8)}`;

            const startTime = Date.now();

            const user = await User.create({
                phone: testPhone,
                otp: '123456',
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            });

            const insertTime = Date.now() - startTime;

            expect(user).toBeDefined();
            expect(insertTime).toBeLessThan(200);

            console.log(`✅ Insert Time: ${insertTime}ms`);

            // Cleanup
            await User.deleteOne({ _id: user._id });
        });
    });

    describe('Concurrent Request Performance', () => {
        test('Handle 10 concurrent requests efficiently', async () => {
            const startTime = Date.now();

            const requests = Array(10).fill().map((_, i) =>
                request(app)
                    .post('/api/auth/send-otp')
                    .send({ phone: `${9000000000 + i}` })
            );

            const responses = await Promise.all(requests);

            const totalTime = Date.now() - startTime;
            const avgTime = totalTime / 10;

            const performance = {
                concurrentRequests: 10,
                totalTime: `${totalTime}ms`,
                avgTimePerRequest: `${avgTime.toFixed(2)}ms`,
                allSuccessful: responses.every(r => r.status === 200),
                threshold: '< 3000ms total'
            };

            console.log('Concurrent Performance:');
            console.log(JSON.stringify(performance, null, 2));

            expect(totalTime).toBeLessThan(3000);
            console.log(`✅ 10 concurrent requests: ${totalTime}ms total`);
        });
    });

    describe('Data Loading Performance', () => {
        test('Load multiple users - Should be fast', async () => {
            const User = require('../../src/models/User');

            // Create test users
            const testUsers = Array(5).fill().map((_, i) => ({
                phone: `66${Date.now().toString().slice(-8)}${i}`,
                otp: '123456',
                otpExpiry: new Date(Date.now() + 10 * 60 * 1000)
            }));

            await User.insertMany(testUsers);

            const startTime = Date.now();

            const users = await User.find({
                phone: { $regex: `^66` }
            }).limit(10);

            const loadTime = Date.now() - startTime;

            expect(users.length).toBeGreaterThan(0);
            expect(loadTime).toBeLessThan(100);

            console.log(`✅ Loaded ${users.length} users in ${loadTime}ms`);

            // Cleanup
            await User.deleteMany({
                phone: { $regex: `^66` }
            });
        });
    });

    describe('Performance Under Load', () => {
        test('Maintain performance with 50 sequential requests', async () => {
            const times = [];

            for (let i = 0; i < 50; i++) {
                const start = Date.now();

                await request(app)
                    .post('/api/auth/send-otp')
                    .send({ phone: `9${String(i).padStart(9, '0')}` });

                times.push(Date.now() - start);
            }

            const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
            const maxTime = Math.max(...times);
            const minTime = Math.min(...times);

            const performance = {
                requests: 50,
                avgResponseTime: `${avgTime.toFixed(2)}ms`,
                minResponseTime: `${minTime}ms`,
                maxResponseTime: `${maxTime}ms`,
                performanceDegradation: maxTime / minTime
            };

            console.log('Load Test Results:');
            console.log(JSON.stringify(performance, null, 2));

            // Performance should not degrade significantly
            expect(performance.performanceDegradation).toBeLessThan(5);

            console.log(`✅ Performance stable under load`);
        });
    });

    describe('Memory and Resource Usage', () => {
        test('Monitor memory usage during operations', () => {
            const memoryBefore = process.memoryUsage();

            // Perform memory-intensive operation
            const data = Array(1000).fill().map((_, i) => ({
                id: i,
                value: `data-${i}`
            }));

            const memoryAfter = process.memoryUsage();

            const memoryIncrease = {
                heapUsed: ((memoryAfter.heapUsed - memoryBefore.heapUsed) / 1024 / 1024).toFixed(2) + ' MB',
                heapTotal: ((memoryAfter.heapTotal - memoryBefore.heapTotal) / 1024 / 1024).toFixed(2) + ' MB'
            };

            console.log('Memory Usage:');
            console.log(JSON.stringify(memoryIncrease, null, 2));

            // Memory increase should be reasonable
            const heapIncreaseMB = parseFloat(memoryIncrease.heapUsed);
            expect(heapIncreaseMB).toBeLessThan(100);

            console.log(`✅ Memory usage within acceptable limits`);
        });
    });
});
