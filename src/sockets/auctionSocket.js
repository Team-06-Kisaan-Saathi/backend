const Auction = require("../models/Auction");

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("Buyer connected:", socket.id);

    // Join auction room
    socket.on("joinAuction", (auctionId) => {
      socket.join(auctionId);
      console.log(`Socket ${socket.id} joined auction ${auctionId}`);
    });

    // Join User Room (for private notifications)
    socket.on("joinUserRoom", (userId) => {
      socket.join(`user:${userId}`);
      console.log(`Socket ${socket.id} joined user room user:${userId}`);
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

      // Check for current highest bidder to notify them
      let previousHighestBidder = null;
      if (auction.bids.length > 0) {
        // Assuming bids are not sorted, need to find max. 
        // In a real app, we might store currentHighest in the auction doc itself for speed.
        const highestBid = auction.bids.reduce((max, bid) => bid.amount > max.amount ? bid : max, { amount: 0 });
        if (highestBid.amount >= amount) {
          socket.emit("bidError", "Bid amount must be higher than current highest bid");
          return;
        }
        previousHighestBidder = highestBid.buyerId;
      }

      auction.bids.push({ buyerId, amount });
      await auction.save();

      // Broadcast updated bids to ALL buyers
      io.to(auctionId).emit("newBid", {
        auctionId,
        buyerId,
        amount
      });

      // Notify outbid user
      if (previousHighestBidder && previousHighestBidder.toString() !== buyerId) {
        io.to(`user:${previousHighestBidder}`).emit("outbid", {
          message: `You have been outbid on crop ${auction.crop}`,
          auctionId,
          newAmount: amount
        });
      }
    });

    socket.on("disconnect", () => {
      console.log("Buyer disconnected:", socket.id);
    });
  });
};
