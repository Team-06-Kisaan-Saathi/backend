const Auction = require("../models/Auction");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Buyer connected:", socket.id);

    // Join auction room
    socket.on("joinAuction", (auctionId) => {
      socket.join(auctionId);
      console.log(`Socket ${socket.id} joined auction ${auctionId}`);
    });

    // Place bid (LIVE)
    socket.on("placeBid", async (data) => {
      const { auctionId, buyerId, amount } = data;

      const auction = await Auction.findById(auctionId);
      if (!auction || auction.status !== "OPEN") {
        socket.emit("bidError", "Auction closed or invalid");
        return;
      }

      if (amount < auction.basePrice) {
        socket.emit("bidError", "Bid below base price");
        return;
      }

      auction.bids.push({ buyerId, amount });
      await auction.save();

      // Broadcast updated bids to ALL buyers
      io.to(auctionId).emit("newBid", {
        auctionId,
        buyerId,
        amount
      });
    });

    socket.on("disconnect", () => {
      console.log("Buyer disconnected:", socket.id);
    });
  });
};
