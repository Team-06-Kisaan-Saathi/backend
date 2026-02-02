const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");

require("dotenv").config();

let farmerToken, adminToken;
let farmerId;

describe("User Verification Module", () => {
    beforeAll(async () => {
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI);
        }
        await User.deleteMany({ phone: { $in: ["6666666666", "7777777777"] } });

        // Register Farmer
        const farmerRes = await request(app).post("/api/auth/register").send({
            name: "Farmer Verify", phone: "6666666666", role: "farmer", password: "pwd"
        });
        farmerId = farmerRes.body.user._id;
        const fLogin = await request(app).post("/api/auth/login").send({ phone: "6666666666", password: "pwd" });
        farmerToken = fLogin.body.token;

        // Register & Create Admin (simulated by updating role directly)
        const adminRes = await request(app).post("/api/auth/register").send({
            name: "Admin User", phone: "7777777777", role: "farmer", password: "pwd"
        });
        const adminLogin = await request(app).post("/api/auth/login").send({ phone: "7777777777", password: "pwd" });
        adminToken = adminLogin.body.token;

        await User.findByIdAndUpdate(adminRes.body.user._id, { role: "admin" });
    });

    afterAll(async () => {
        await User.deleteMany({ phone: { $in: ["6666666666", "7777777777"] } });
        await mongoose.connection.close();
    });

    test("Farmer can submit verification request", async () => {
        const res = await request(app).post("/api/users/verify")
            .set("Authorization", `Bearer ${farmerToken}`)
            .send({
                aadhaarNumber: "123412341234",
                panNumber: "ABCDE1234F"
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toContain("submitted");

        // Verify pending status in DB
        const user = await User.findById(farmerId);
        expect(user.verificationStatus).toBe("pending");
        expect(user.aadhaarNumber).toBe("123412341234");
    });

    test("Admin can approve verification", async () => {
        const res = await request(app).put(`/api/users/${farmerId}/verify-status`)
            .set("Authorization", `Bearer ${adminToken}`)
            .send({
                status: "approved",
                comment: "All looks good"
            });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.verificationStatus).toBe("approved");

        const user = await User.findById(farmerId);
        expect(user.verificationStatus).toBe("approved");
    });

    test("Profile should show verification status", async () => {
        const res = await request(app).get("/api/users/profile")
            .set("Authorization", `Bearer ${farmerToken}`);

        expect(res.statusCode).toBe(200);
        expect(res.body.user.verificationStatus).toBe("approved");
    });
});
