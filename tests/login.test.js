const mongoose = require("mongoose");
const request = require("supertest");
const app = require("../src/app");
const User = require("../src/models/User");

require("dotenv").config();

describe("Auth Module - Password Login", () => {
    beforeAll(async () => {
        await mongoose.connect(process.env.MONGO_URI);
        await User.deleteMany({ phone: "8888888888" });
    }, 30000);

    afterAll(async () => {
        await mongoose.connection.close();
    });

    test("Register with Password", async () => {
        const res = await request(app).post("/api/auth/register").send({
            name: "Login User",
            phone: "8888888888",
            role: "farmer",
            password: "mypassword123"
        });

        expect(res.statusCode).toBe(201);
        expect(res.body.user.phone).toBe("8888888888");
        // Verify password is NOT in response
        expect(res.body.user.password).toBeUndefined();
    });

    test("Login with Correct Password", async () => {
        const res = await request(app).post("/api/auth/login").send({
            phone: "8888888888",
            password: "mypassword123"
        });

        expect(res.statusCode).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();
        expect(res.body.user.phone).toBe("8888888888");
    });

    test("Login with Incorrect Password", async () => {
        const res = await request(app).post("/api/auth/login").send({
            phone: "8888888888",
            password: "wrongpassword"
        });

        expect(res.statusCode).toBe(401);
        expect(res.body.success).toBe(false);
    });
});
