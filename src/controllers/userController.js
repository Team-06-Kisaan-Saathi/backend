const User = require("../models/User");

// CREATE USER
exports.createUser = async (req, res) => {
  try {
    const user = await User.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// GET ALL USERS
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// REQUEST VERIFICATION (Farmer/User)
exports.requestVerification = async (req, res) => {
  try {
    const { aadhaarNumber, panNumber } = req.body;

    if (!aadhaarNumber || !panNumber) {
      return res.status(400).json({ message: "Aadhaar and PAN numbers are required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.aadhaarNumber = aadhaarNumber;
    user.panNumber = panNumber;
    user.verificationStatus = "pending";

    await user.save();

    res.json({
      success: true,
      message: "Verification request submitted",
      status: user.verificationStatus
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE VERIFICATION STATUS (Admin)
exports.updateVerificationStatus = async (req, res) => {
  try {
    const { status, comment } = req.body;
    const userId = req.params.id;

    if (!["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use 'approved' or 'rejected'" });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    user.verificationStatus = status;
    user.verificationComment = comment || "";

    // Optional: If approved, could boost trust score
    if (status === "approved" && user.trustScore < 10) {
      user.trustScore += 2; // Bonus for ID verification
    }

    await user.save();

    res.json({
      success: true,
      message: `User verification ${status}`,
      user: {
        _id: user._id,
        name: user.name,
        verificationStatus: user.verificationStatus
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET MY PROFILE (Including status)
exports.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    // Note: Password is excluded by default in model
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json({
      success: true,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// UPDATE LOCATION (GPS or Dropdown)
exports.updateLocation = async (req, res) => {
  try {
    console.log("\n================ UPDATE LOCATION =================");
    console.log("➡️  Endpoint hit: POST /api/users/location");
    console.log("➡️  User ID:", req.user?._id);
    console.log("➡️  Request body:", req.body);

    const { lat, lng, address } = req.body;

    // Validate input
    if (
      typeof lat !== "number" ||
      typeof lng !== "number" ||
      typeof address !== "string" ||
      !address.trim()
    ) {
      console.log("❌ Validation failed");
      return res.status(400).json({
        message: "address (location name), lat and lng are required",
      });
    }

    console.log("✅ Validation passed");
    console.log("📍 Parsed values:", { lat, lng, address });

    const user = await User.findById(req.user._id);
    if (!user) {
      console.log("❌ User not found in DB");
      return res.status(404).json({ message: "User not found" });
    }

    console.log("👤 User found:", user._id);

    // Update fields
    user.location = address.trim();
    user.locationCoordinates = {
      type: "Point",
      coordinates: [lng, lat], // IMPORTANT: [lng, lat]
    };

    console.log("📝 Updating user with:");
    console.log({
      location: user.location,
      coordinates: user.locationCoordinates.coordinates,
    });

    await user.save();

    //debug
    console.log("User location saved successfully");
    console.log("=================================================\n");

    return res.json({
      success: true,
      message: "Location updated successfully",
      user: {
        _id: user._id,
        location: user.location,
        coordinates: user.locationCoordinates.coordinates,
      },
    });
  } catch (err) {
    console.error("ERROR in updateLocation:", err);
    return res.status(500).json({ error: err.message });
  }
};



// UPDATE PROFILE (Name, Language)
exports.updateProfile = async (req, res) => {
  try {
    const { name, language } = req.body;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (name) user.name = name;
    if (language) user.language = language;

    await user.save();

    res.json({
      success: true,
      message: "Profile updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        language: user.language
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET PUBLIC PROFILE (Safe Data)
exports.getPublicProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select(
      "name role language trustScore verificationStatus location totalTransactions createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      success: true,
      user
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
