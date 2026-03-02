const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const MandiPrice = require("../src/models/MandiPrice");
const User = require("../src/models/User");

// Mock the Gemini LLM so we don't need real API keys or incur costs during testing
jest.mock("@google/genai", () => {
    return {
        GoogleGenAI: jest.fn().mockImplementation(() => {
            return {
                models: {
                    generateContent: jest.fn().mockResolvedValue({
                        text: JSON.stringify({
                            historical: [
                                { date: "2023-01-01", price: 2000 },
                                { date: "2023-01-02", price: 2050 }
                            ],
                            predicted: [
                                { date: "2023-01-03", price: 2100 },
                                { date: "2023-01-04", price: 2150 },
                                { date: "2023-01-05", price: 2200 },
                                { date: "2023-01-06", price: 2250 },
                                { date: "2023-01-07", price: 2300 }
                            ],
                            recommendation: "Test Mocked Recommendation. Prices look stable."
                        })
                    })
                }
            };
        })
    };
});

require("dotenv").config();
// Ensure the mocked route proceeds without blocking on a missing environment variable
process.env.GEMINI_API_KEY = "test_mock_key";

let token;

describe("Epic 4: AI Predictive Analytics Module", () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        await MandiPrice.deleteMany({});
        await User.deleteMany({ phone: "8881112222" });

        // Directly register user to DB to bypass API auth complexities in unit test
        const user = await User.create({
            name: "Analytics Farmer",
            phone: "8881112222",
            role: "farmer",
            password: "pwd",
            otpVerified: true
        });

        // Generate token directly
        const jwt = require("jsonwebtoken");
        token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

        // Seed Mock Historical Data locally for tests
        const DUMMY_HISTORICAL_DATA = [
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2050, offsetDays: -7 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2065, offsetDays: -6 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2060, offsetDays: -5 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2080, offsetDays: -4 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2095, offsetDays: -3 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2110, offsetDays: -2 },
            { crop: "Wheat", mandi: "Azadpur Mandi (Delhi)", locationName: "Delhi", pricePerQuintal: 2105, offsetDays: -1 }
        ];
        const now = new Date();
        const records = DUMMY_HISTORICAL_DATA.map(data => {
            const date = new Date(now);
            date.setDate(now.getDate() + data.offsetDays);
            return { ...data, location: { type: "Point", coordinates: [0, 0] }, date: date };
        });
        await MandiPrice.insertMany(records);
    });

    afterAll(async () => {
        await MandiPrice.deleteMany({});
        await User.deleteMany({ phone: "8881112222" });
        await mongoose.connection.close();
    });

    test("GET /api/analytics/price-forecast - Valid Request (Wheat, Azadpur)", async () => {
        const res = await request(app)
            .get("/api/analytics/price-forecast?crop=Wheat&mandi=Azadpur&days=5")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);

        const data = res.body.data;
        expect(data.crop).toBe("Wheat");
        expect(data.mandi).toBe("Azadpur");

        // Check Historical Array
        expect(data.historical).toBeDefined();
        expect(data.historical.length).toBeGreaterThan(0);
        expect(data.historical[0]).toHaveProperty("date");
        expect(data.historical[0]).toHaveProperty("price");

        // Check Predicted Array
        expect(data.predicted).toBeDefined();
        expect(data.predicted.length).toBe(5); // Requested 5 days
        expect(data.predicted[0]).toHaveProperty("date");
        expect(data.predicted[0]).toHaveProperty("price");

        // Check Selling Recommendation Engine
        expect(data.recommendation).toBeDefined();
        expect(typeof data.recommendation).toBe("string");
        console.log("Generated ML Recommendation String:", data.recommendation);
    });

    test("GET /api/analytics/price-forecast - Invalid Request (Missing Params)", async () => {
        const res = await request(app)
            .get("/api/analytics/price-forecast")
            .set("Authorization", `Bearer ${token}`);

        expect(res.statusCode).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toContain("required");
    });
});
