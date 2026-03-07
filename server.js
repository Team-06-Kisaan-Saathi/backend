require("dotenv").config();

const http = require("http");
const app = require("./src/app");
const connectDB = require("./src/config/db");

connectDB();

const server = http.createServer(app);

// Apply Security Enhancements specifically in Production/Dev modes (Bypasses Supertest)
const helmet = require("helmet");

// app.use(helmet());

const { Server } = require("socket.io");
const io = new Server(server, {
  cors: {
    origin: [
      "http://localhost:3000",
      "http://localhost:5173",
      "https://team-06-kisaan-saathi.github.io"
    ],
    credentials: true,
    methods: ["GET", "POST"]
  }
});

require("./src/sockets/auctionSocket")(io);
require("./src/sockets/chatSocket")(io);

// Expose io so controllers can emit socket events
app.set("io", io);

const PORT = process.env.PORT || 5001;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});
