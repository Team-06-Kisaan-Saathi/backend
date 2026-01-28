const express = require("express");
const router = express.Router();
const controller = require("../controllers/authController");

router.post("/register", controller.registerUser);
router.post("/send-otp", controller.sendOTP);
router.post("/verify-otp", controller.verifyOTP);

module.exports = router;
