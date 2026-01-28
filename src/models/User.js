const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true,
    unique: true
  },
  role: {
    type: String,
    enum: ["farmer", "buyer"],
    required: true
  },
  language: {
    type: String,
    default: "en"
  },
  trustScore: {
    type: Number,
    default: 0
  },

  otp: {
    type: String
  },
  otpVerified: {
    type: Boolean,
    default: false
  },

  
    totalTransactions: {
      type: Number,
      default: 0
    }

}, { timestamps: true });

module.exports = mongoose.model("User", userSchema);
