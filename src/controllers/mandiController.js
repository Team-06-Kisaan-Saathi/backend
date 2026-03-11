const MandiPrice = require("../models/MandiPrice");
const Watchlist = require("../models/Watchlist");

// In-memory cache for Mandi Prices
let priceCache = {
  data: null,
  lastUpdated: null,
  ttl: 10 * 60 * 1000, // 10 minutes
};

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
 */
exports.addMandiPrice = async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  try {
    const { crop, mandi, location, locationName, price, unit } = req.body;

    const pricePerQuintal = standardizeToQuintal(price, unit);
    if (!pricePerQuintal) {
      return res.status(400).json({ success: false, message: "Invalid price/unit", requestId });
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

    // Invalidate cache on new data
    priceCache.data = null;

    res.status(201).json({ success: true, data: mandiPrice, requestId });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [${requestId}] Error adding mandi price:`, err.message);
    res.status(500).json({ success: false, error: "Database error during write", message: err.message, requestId });
  }
};

/**
 * FETCH NEARBY MANDIS
 */
exports.getNearbyMandis = async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  try {
    const { lat, lng, distKm = 50, limit = 5 } = req.query;

    // 1. Check if empty and seed
    const count = await MandiPrice.countDocuments();
    if (count === 0) {
      // (Simplified seed for speed - full seed is in getMandiPrices)
      const defaults = [{
        crop: "Tomato", mandi: "Azadpur", locationName: "Azadpur Mandi, Delhi",
        location: { type: "Point", coordinates: [77.17, 28.7] }, pricePerQuintal: 1500, date: new Date()
      }];
      await MandiPrice.insertMany(defaults);
    }

    if (!lat || !lng || (parseFloat(lat) === 0 && parseFloat(lng) === 0)) {
      // If no location set, return top 5 mandis sorted by name as fallback
      const fallback = await MandiPrice.aggregate([
        { $group: { _id: "$mandi", mandiId: { $first: "$mandi" }, mandiName: { $first: "$locationName" }, coords: { $first: "$location.coordinates" } } },
        { $limit: Number(limit) || 5 },
        { $project: { _id: 0, mandiId: 1, mandiName: 1, coordinates: "$coords", distanceKm: { $literal: 0 } } }
      ]);
      return res.json({ success: true, count: fallback.length, data: fallback, message: "No user location provided, showing featured mandis.", requestId });
    }

    const lim = Math.min(Math.max(Number(limit) || 5, 1), 20);

    const mandis = await MandiPrice.aggregate([
      {
        $geoNear: {
          key: "location",
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)],
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

    return res.json({ success: true, count: mandis.length, data: mandis, requestId });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [${requestId}] Error fetching nearby mandis:`, err.message);
    return res.status(500).json({ success: false, error: "Internal server error", message: err.message, requestId });
  }
};

/**
 * FETCH MANDI PRICES WITH CACHING & DEDUPLICATION
 */
exports.getMandiPrices = async (req, res) => {
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  const startTime = Date.now();

  try {
    const { crop, location, sort, mandis, limit = 100, bypassCache } = req.query;

    // 1. Auto-seed if empty
    const count = await MandiPrice.countDocuments();
    if (count === 0) {
      console.log("Empty mandi price database. Seeding defaults...");
      const crops = ["Tomato", "Onion", "Potato", "Wheat", "Rice", "Maize"];
      const locations = [
        { name: "Azadpur Mandi, Delhi", coords: [77.170, 28.707] },
        { name: "Vashi APMC, Mumbai", coords: [73.00, 19.05] },
        { name: "Pune APMC, Maharashtra", coords: [73.856, 18.520] },
        { name: "Nashik Mandi, Maharashtra", coords: [73.789, 19.997] },
        { name: "Ahmedabad Market, Gujarat", coords: [72.571, 23.022] },
        { name: "Bangalore APMC, Karnataka", coords: [77.594, 12.971] }
      ];

      const basePrices = { Tomato: 1500, Onion: 2000, Potato: 1200, Wheat: 2400, Rice: 3500, Maize: 1800 };
      const seedData = [];
      locations.forEach(m => {
        crops.forEach(c => {
          seedData.push({
            crop: c,
            mandi: m.name.split(",")[0],
            location: { type: "Point", coordinates: m.coords },
            locationName: m.name,
            pricePerQuintal: Math.round(basePrices[c] * (0.9 + Math.random() * 0.2)),
            date: new Date()
          });
        });
      });
      await MandiPrice.insertMany(seedData);
      console.log(`Seeded ${seedData.length} mandi price records.`);
    }

    // Check Cache first if it's a generic request
    const isGenericRequest = !crop && !location && !mandis && limit == 100;
    if (isGenericRequest && !bypassCache && priceCache.data && (Date.now() - priceCache.lastUpdated < priceCache.ttl)) {
      return res.json({
        success: true,
        data: priceCache.data,
        source: "cache",
        lastUpdated: priceCache.lastUpdated,
        requestId
      });
    }

    const filter = {};
    if (crop) filter.crop = { $regex: crop, $options: "i" };
    if (location) filter.locationName = { $regex: location, $options: "i" };

    if (mandis) {
      filter.mandi = {
        $in: String(mandis).split(",").map((s) => s.trim()).filter(Boolean),
      };
    }

    let query = MandiPrice.find(filter);

    if (sort === "price_desc") query = query.sort({ pricePerQuintal: -1 });
    else if (sort === "price_asc") query = query.sort({ pricePerQuintal: 1 });
    else query = query.sort({ date: -1 });

    const lim = Math.min(Math.max(Number(limit) || 100, 1), 500);
    let prices = await query.limit(lim).lean();

    // Deduplicate records (Keep latest for same crop + mandi)
    const uniqueMap = new Map();
    prices.forEach(p => {
      const key = `${p.crop}-${p.mandi}`;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, p);
      }
    });

    let resultRows = Array.from(uniqueMap.values()).map(row => ({
      ...row,
      isBestPrice: false
    }));

    // Fix: Redo the in-memory sort after mapping values
    if (sort === "price_desc") {
      resultRows.sort((a, b) => b.pricePerQuintal - a.pricePerQuintal);
      if (resultRows.length > 0) resultRows[0].isBestPrice = true;
    } else if (sort === "price_asc") {
      resultRows.sort((a, b) => a.pricePerQuintal - b.pricePerQuintal);
    }

    // Update generic cache
    if (isGenericRequest) {
      priceCache.data = resultRows;
      priceCache.lastUpdated = Date.now();
    }

    res.json({
      success: true,
      count: resultRows.length,
      data: resultRows,
      source: "live",
      lastUpdated: new Date(),
      requestId
    });
  } catch (err) {
    console.error(`[${new Date().toISOString()}] [${requestId}] Error fetching mandi prices:`, err.message);
    res.status(500).json({
      success: false,
      error: "Failed to fetch market data",
      message: err.message,
      requestId
    });
  }
};

