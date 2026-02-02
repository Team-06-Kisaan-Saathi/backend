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
// UPDATE LOCATION (For Nearby Search)
exports.updateLocation = async (req, res) => {
  try {
    const { lat, lng, address } = req.body;

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and Longitude are required" });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Update coordinates
    user.locationCoordinates = {
      type: "Point",
      coordinates: [parseFloat(lng), parseFloat(lat)]
    };

    // Update text address if provided
    if (address) {
      user.location = address;
    }

    await user.save();

    res.json({
      success: true,
      message: "Location updated successfully",
      user: {
        _id: user._id,
        name: user.name,
        location: user.location,
        coordinates: user.locationCoordinates.coordinates
      }
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
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
