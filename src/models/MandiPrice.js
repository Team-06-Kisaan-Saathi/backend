const mongoose = require("mongoose");

const mandiPriceSchema = new mongoose.Schema(
  {
    crop: {
      type: String,
      required: true
    },
    mandi: {
      type: String,
      required: true
    },
    location: {
      type: String,
      required: true
    },
    // NORMALIZED PRICE: ₹ per quintal
    pricePerQuintal: {
      type: Number,
      required: true
    },
    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model("MandiPrice", mandiPriceSchema);
