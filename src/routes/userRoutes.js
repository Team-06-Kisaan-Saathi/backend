const express = require("express");
const router = express.Router();
const userController = require("../controllers/userController");
const { protect } = require("../middleware/authMiddleware");

// Create user (PUBLIC – registration)
router.post("/", userController.createUser);

// Get all users (PROTECTED)
router.get(
  "/",
  protect,
  userController.getUsers
);

module.exports = router;
