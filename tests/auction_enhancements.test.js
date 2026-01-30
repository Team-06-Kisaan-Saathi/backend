const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Auction = require("../src/models/Auction");

require("dotenv").config();

let farmerToken, buyerToken;
let farmerId, buyerId;

describe("Auction Module Enhancements", () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URI);
        // Clean up
        await User.deleteMany({ phone: { $in: ["1111111111", "2222222222"] } });
        await Auction.deleteMany({});

        // Register Farmer
        const farmerRes = await request(app).post("/api/auth/register").send({
            name: "Farmer One", phone: "1111111111", role: "farmer", password: "pwd"
        });
        farmerId = farmerRes.body.user._id;

        // Login Farmer
        const fLogin = await request(app).post("/api/auth/login").send({ phone: "1111111111", password: "pwd" });
        farmerToken = fLogin.body.token;

        // Register Buyer
        const buyerRes = await request(app).post("/api/auth/register").send({
            name: "Buyer One", phone: "2222222222", role: "buyer", password: "pwd"
        });
        buyerId = buyerRes.body.user._id;

        // Login Buyer
        const bLogin = await request(app).post("/api/auth/login").send({ phone: "2222222222", password: "pwd" });
        buyerToken = bLogin.body.token;

        // Verify Users are Verified (simulated manually)
        await User.updateMany({}, { otpVerified: true });
    }, 30000);

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test("Search & Filter Auctions (Task 6.1)", async () => {
        // Create 2 auctions
        await request(app).post("/api/auctions").set("Authorization", `Bearer ${farmerToken}`).send({
            crop: "Wheat A", quantityKg: 100, basePrice: 20
        });
        await request(app).post("/api/auctions").set("Authorization", `Bearer ${farmerToken}`).send({
            crop: "Rice B", quantityKg: 200, basePrice: 50
        });

        // Test Search
        const searchRes = await request(app).get("/api/auctions?search=Rice")
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(searchRes.body.length).toBe(1);
        expect(searchRes.body[0].crop).toBe("Rice B");

        // Test Price Filter
        const priceRes = await request(app).get("/api/auctions?minPrice=30")
            .set("Authorization", `Bearer ${buyerToken}`);
        expect(priceRes.body.length).toBe(1);
        expect(priceRes.body[0].basePrice).toBe(50);
    });

    test("My Bids (Task 6.3)", async () => {
        // Find an auction
        const auctions = await request(app).get("/api/auctions").set("Authorization", `Bearer ${buyerToken}`);
        const auctionId = auctions.body[0]._id;

        // Since we cannot easily simulate sockets in generic API tests, we will MANUALLY push a bid to DB to verify the GET endpoint
        // Or if there is a REST endpoint for bidding? 
        // Checking codebase: Bidding is ONLY via Sockets.
        // So we will simulate a bid by updating the DB directly for this test purpose.

        const auction = await Auction.findById(auctionId);
        auction.bids.push({ buyerId: buyerId, amount: 60 });
        await auction.save();

        // Get My Bids
        const res = await request(app).get("/api/auctions/bids/mine")
            .set("Authorization", `Bearer ${buyerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.length).toBeGreaterThan(0);
        expect(res.body[0]._id).toBe(auctionId);
    });
});
