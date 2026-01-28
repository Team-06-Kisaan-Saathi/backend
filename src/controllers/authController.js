const User = require("../models/User");
const { updateTrustScore } = require("../services/trustService");
const jwt = require("jsonwebtoken");


/**
 * Register user
 */
exports.registerUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json({
      success: true,
      data: user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Send OTP (SIMULATED)
 */
exports.sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    user.otp = otp;
    user.otpVerified = false;
    await user.save();

    // OTP is returned ONLY for demo/testing
    res.json({
      success: true,
      message: "OTP sent (simulated)",
      otp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * Verify OTP
 */
exports.verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const user = await User.findOne({ phone });
    if (!user || user.otp !== otp) {
      return res.status(401).json({ message: "Invalid OTP" });
    }

    user.otpVerified = true;
    user.otp = null;

    user.totalTransactions += 1;
    user.trustScore = updateTrustScore(user);

    await user.save();

    // 🔑 ISSUE JWT TOKEN (THIS IS THE MISSING LINK)
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      message: "OTP verified",
      token,                 // 👈 REQUIRED FOR MIDDLEWARE
      trustScore: user.trustScore
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
