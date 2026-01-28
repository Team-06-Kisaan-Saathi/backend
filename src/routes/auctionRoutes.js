const express = require("express");
const router = express.Router();

const {
  createAuction,
  closeAuction,
  getAuctions
} = require("../controllers/auctionController");

const {
  protect,
  authorize,
  requireVerifiedUser
} = require("../middleware/authMiddleware");

// Farmer-only & verified
router.post(
  "/",
  protect,
  requireVerifiedUser,
  authorize("farmer"),
  createAuction
);

// Farmer-only & verified
router.post(
  "/:id/close",
  protect,
  requireVerifiedUser,
  authorize("farmer"),
  closeAuction
);

// Any verified user can view auctions
router.get(
  "/",
  protect,
  requireVerifiedUser,
  getAuctions
);

module.exports = router;
