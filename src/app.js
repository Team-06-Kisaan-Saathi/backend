const express = require("express");
const connectDB = require("./config/db");
require("dotenv").config();

const app = express();
app.use(express.json());

if (process.env.NODE_ENV !== "test") {
  connectDB();
}

app.get("/", (req, res) => {
  res.send("Backend + MongoDB Atlas working");
});

const userRoutes = require("./routes/userRoutes");

app.use("/api/users", userRoutes);
app.use("/api/multimodal", require("./routes/multimodalRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/auctions", require("./routes/auctionRoutes"));

app.use("/api/mandi", require("./routes/mandiRoutes"));
app.use("/api/inventory", require("./routes/inventoryRoutes"));
app.use("/api/watchlist", require("./routes/watchlistRoutes"));

module.exports = app;
