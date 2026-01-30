const Auction = require("../models/Auction");

// Create auction (Farmer)
exports.createAuction = async (req, res) => {
  try {
    const auction = await Auction.create({
      farmerId: req.user._id,        // 🔐 comes from JWT
      crop: req.body.crop,
      quantityKg: req.body.quantityKg,
      basePrice: req.body.basePrice
    });

    res.status(201).json({
      success: true,
      data: auction
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Close auction (Farmer / System)
exports.closeAuction = async (req, res) => {
  try {
    const auction = await Auction.findById(req.params.id);

    if (!auction) {
      return res.status(404).json({ message: "Auction not found" });
    }
    if (auction.farmerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        message: "You are not allowed to close this auction"
      });
    }


    auction.status = "CLOSED";

    if (auction.bids.length > 0) {
      const highest = auction.bids.reduce((max, bid) =>
        bid.amount > max.amount ? bid : max
      );

      auction.winningBid = {
        buyerId: highest.buyerId,
        amount: highest.amount
      };
    }

    await auction.save();

    res.json({
      success: true,
      message: "Auction closed",
      winningBid: auction.winningBid
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get all auctions with filters
exports.getAuctions = async (req, res) => {
  try {
    const { search, minPrice, maxPrice, cropType } = req.query;

    const query = { status: "OPEN" }; // Default to OPEN

    // Search by crop name (case-insensitive)
    if (search) {
      query.crop = { $regex: search, $options: "i" };
    }

    // Filter by Crop Type
    if (cropType) {
      query.crop = { $regex: cropType, $options: "i" }; // Assuming crop field holds type or name
    }

    // Filter by Price Range
    if (minPrice || maxPrice) {
      query.basePrice = {};
      if (minPrice) query.basePrice.$gte = Number(minPrice);
      if (maxPrice) query.basePrice.$lte = Number(maxPrice);
    }

    const auctions = await Auction.find(query).sort({ createdAt: -1 });
    res.json(auctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Get auctions where I have bid
exports.getMyBids = async (req, res) => {
  try {
    const myAuctions = await Auction.find({ "bids.buyerId": req.user._id })
      .sort({ "bids.time": -1 });
    res.json(myAuctions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
