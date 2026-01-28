const express = require("express");
const router = express.Router();
const controller = require("../controllers/mandiController");
const {
  protect,
  requireVerifiedUser
} = require("../middleware/authMiddleware");

// Add mandi price data (only verified users)
router.post(
  "/",
  protect,
  requireVerifiedUser,
  controller.addMandiPrice
);

// Get mandi prices (only verified users)
router.get(
  "/",
  protect,
  requireVerifiedUser,
  controller.getMandiPrices
);

module.exports = router;
