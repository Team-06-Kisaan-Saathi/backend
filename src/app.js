const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();
app.use(express.json());

connectDB();

app.get("/", (req, res) => {
  res.send("Backend + MongoDB Atlas working");
});

const userRoutes = require("./routes/userRoutes");

app.use("/api/users", userRoutes);
app.use("/api/multimodal", require("./routes/multimodalRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auctions", require("./routes/auctionRoutes"));

app.use("/api/mandi", require("./routes/mandiRoutes"));

module.exports = app;
