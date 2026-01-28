const MandiPrice = require("../models/MandiPrice");

/**
 * ADD MANDI PRICE DATA (for testing / admin)
 */
exports.addMandiPrice = async (req, res) => {
  try {
    const mandiPrice = await MandiPrice.create(req.body);
    res.status(201).json({
      success: true,
      data: mandiPrice
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/**
 * FETCH MANDI PRICES
 * Filters: crop, location
 */
exports.getMandiPrices = async (req, res) => {
  try {
    const { crop, location } = req.query;

    const filter = {};

    if (crop) filter.crop = crop;
    if (location) filter.location = location;

    const prices = await MandiPrice.find(filter).sort({ date: -1 });

    res.json({
      success: true,
      count: prices.length,
      data: prices
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
