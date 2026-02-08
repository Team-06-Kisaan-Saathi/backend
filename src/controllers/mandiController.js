const MandiPrice = require("../models/MandiPrice");

/** helper to standardize to ₹/quintal */
function parseNumber(x) {
  if (typeof x === "number") return x;
  const cleaned = String(x || "").replace(/[₹, ]/g, "").trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function normalizeUnit(unit) {
  const u = String(unit || "").toLowerCase();
  if (u.includes("quintal")) return "quintal";
  return "kg";
}

function standardizeToQuintal(price, unit) {
  const num = parseNumber(price);
  if (num === null) return null;

  const u = normalizeUnit(unit);
  let pricePerQuintal = num;

  // if ₹/kg => ₹/quintal
  if (u === "kg") pricePerQuintal = num * 100;

  if (!Number.isFinite(pricePerQuintal) || pricePerQuintal <= 0) return null;
  return pricePerQuintal;
}

/**
 * ADD MANDI PRICE DATA (for testing / admin)
 * cleansing + store canonical ₹/quintal
 */
exports.addMandiPrice = async (req, res) => {
  try {
    const { crop, mandi, location, locationName, price, unit } = req.body;

    const pricePerQuintal = standardizeToQuintal(price, unit);
    if (!pricePerQuintal) {
      return res.status(400).json({ success: false, message: "Invalid price/unit" });
    }

    const mandiPrice = await MandiPrice.create({
      crop,
      mandi,
      location,
      locationName,
      pricePerQuintal,
      rawPrice: price,
      rawUnit: unit,
    });

    res.status(201).json({ success: true, data: mandiPrice });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

/**
 * FETCH NEARBY MANDIS
 * use limit param + return lat/lng + distanceKm
 */
exports.getNearbyMandis = async (req, res) => {
  try {
    const { lat, lng, distKm = 50, limit = 5 } = req.query;

    if (!lat || !lng) {
      return res.status(400).json({
        success: false,
        message: "Latitude and Longitude required",
      });
    }

    const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);

    const mandis = await MandiPrice.aggregate([
      {
        $geoNear: {
          key: "location", // ✅ IMPORTANT
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)], // [lng, lat]
          },
          distanceField: "distanceMeters",
          maxDistance: Number(distKm) * 1000,
          spherical: true,
        },
      },
      {
        $group: {
          _id: "$mandi",
          mandiId: { $first: "$mandi" },
          mandiName: { $first: "$locationName" },
          coords: { $first: "$location.coordinates" },
          distanceMeters: { $first: "$distanceMeters" },
        },
      },
      { $addFields: { distanceKm: { $divide: ["$distanceMeters", 1000] } } },
      { $sort: { distanceMeters: 1 } },
      { $limit: lim },
      {
        $project: {
          _id: 0,
          mandiId: 1,
          mandiName: 1,
          coordinates: "$coords",
          distanceKm: 1,
        },
      },
    ]);

    return res.json({ success: true, count: mandis.length, data: mandis });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
};


/**
 * FETCH MANDI PRICES
 * apply mandis filter too
 */
exports.getMandiPrices = async (req, res) => {
  try {
    const { crop, location, sort, mandis, limit = 80 } = req.query;

    const filter = {};
    if (crop) filter.crop = crop;
    if (location) filter.locationName = { $regex: location, $options: "i" };

    // filter by specific mandis (comma separated)
    if (mandis) {
      filter.mandi = {
        $in: String(mandis)
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    }

    let query = MandiPrice.find(filter);

    if (sort === "price_desc") query = query.sort({ pricePerQuintal: -1 });
    else query = query.sort({ date: -1 });

    const lim = Math.min(Math.max(Number(limit) || 80, 1), 200);
    let prices = await query.limit(lim);

    if (sort === "price_desc" && prices.length > 0) {
      prices = prices.map((p, index) => ({
        ...p.toObject(),
        isBestPrice: index === 0,
      }));
    }

    res.json({ success: true, count: prices.length, data: prices });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};
