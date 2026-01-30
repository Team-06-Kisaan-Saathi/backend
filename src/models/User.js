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
  },

  location: {
    type: String,
    default: ""
  },
  password: {
    type: String,
    select: false // Don't return password by default
  }

}, { timestamps: true });

// Encrypt password using bcrypt
const bcrypt = require("bcryptjs");

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model("User", userSchema);
