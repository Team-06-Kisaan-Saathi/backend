const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");
const Auction = require("../src/models/Auction");

require("dotenv").config();

let farmerToken, buyerToken, otherFarmerToken;
let farmerId, buyerId, auctionId;

describe("Auction Module Full Verification", () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        await User.deleteMany({ phone: { $in: ["3333333333", "4444444444", "5555555555"] } });
        await Auction.deleteMany({});

        // 1. Register & Login Farmer
        const fRes = await request(app).post("/api/auth/register").send({
            name: "Farmer Two", phone: "3333333333", role: "farmer", password: "pwd"
        });
        farmerId = fRes.body.user._id;
        const fLogin = await request(app).post("/api/auth/login").send({ phone: "3333333333", password: "pwd" });
        farmerToken = fLogin.body.token;

        // 2. Register & Login Buyer
        const bRes = await request(app).post("/api/auth/register").send({
            name: "Buyer Two", phone: "4444444444", role: "buyer", password: "pwd"
        });
        buyerId = bRes.body.user._id;
        const bLogin = await request(app).post("/api/auth/login").send({ phone: "4444444444", password: "pwd" });
        buyerToken = bLogin.body.token;

        // 3. Register & Login Other Farmer (for negative test)
        const ofRes = await request(app).post("/api/auth/register").send({
            name: "Farmer Three", phone: "5555555555", role: "farmer", password: "pwd"
        });
        const ofLogin = await request(app).post("/api/auth/login").send({ phone: "5555555555", password: "pwd" });
        otherFarmerToken = ofLogin.body.token;

        // Verify Users
        await User.updateMany({}, { otpVerified: true });
    }, 30000);

    afterAll(async () => {
        await User.deleteMany({ phone: { $in: ["3333333333", "4444444444", "5555555555"] } });
        await Auction.deleteMany({});
        await mongoose.connection.close();
    });

    test("Farmer can create and close an auction (Happy Path)", async () => {
        // Create
        const createRes = await request(app).post("/api/auctions")
            .set("Authorization", `Bearer ${farmerToken}`)
            .send({ crop: "Corn X", quantityKg: 500, basePrice: 15 });

        expect(createRes.statusCode).toBe(201);
        auctionId = createRes.body.data._id;

        // Simulate a bid properly pushed to DB (since we are testing REST API logic not sockets here)
        const auction = await Auction.findById(auctionId);
        auction.bids.push({ buyerId: buyerId, amount: 20 });
        await auction.save();

        // Close
        const closeRes = await request(app).post(`/api/auctions/${auctionId}/close`)
            .set("Authorization", `Bearer ${farmerToken}`);

        expect(closeRes.statusCode).toBe(200);
        expect(closeRes.body.success).toBe(true);
        expect(closeRes.body.winningBid).toBeDefined();
        expect(closeRes.body.winningBid.amount).toBe(20);
        expect(closeRes.body.winningBid.buyerId.toString()).toBe(buyerId.toString());

        // Verify status in DB
        const updatedAuction = await Auction.findById(auctionId);
        expect(updatedAuction.status).toBe("CLOSED");
    });

    test("Other farmer cannot close someone else's auction (Security)", async () => {
        // Create another auction
        const createRes = await request(app).post("/api/auctions")
            .set("Authorization", `Bearer ${farmerToken}`)
            .send({ crop: "Corn Y", quantityKg: 100, basePrice: 10 });

        const otherAuctionId = createRes.body.data._id;

        // Try to close with WRONG token
        const closeRes = await request(app).post(`/api/auctions/${otherAuctionId}/close`)
            .set("Authorization", `Bearer ${otherFarmerToken}`); // Different farmer

        expect(closeRes.statusCode).toBe(403);
    });
});
