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
  const users = await User.find();
  res.json(users);
};
