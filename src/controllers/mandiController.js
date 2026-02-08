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
// FETCH NEARBY MANDIS
exports.getNearbyMandis = async (req, res) => {
  try {
    let { lat, lng, dist = 50 } = req.query; // Default dist 50km

    // Fallback to User Location if Lat/Lng not provided
    if ((!lat || !lng) && req.user && req.user.locationCoordinates) {
      // req.user.locationCoordinates.coordinates is [lng, lat]
      lng = req.user.locationCoordinates.coordinates[0];
      lat = req.user.locationCoordinates.coordinates[1];
    }

    if (!lat || !lng) {
      return res.status(400).json({ message: "Latitude and Longitude required (or update your profile location)" });
    }

    const mandis = await MandiPrice.aggregate([
      {
        $geoNear: {
          near: {
            type: "Point",
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          distanceField: "distance",
          maxDistance: dist * 1000, // Convert km to meters
          spherical: true
        }
      },
      // Group by Mandi name to get unique list (since multiple crops per mandi)
      {
        $group: {
          _id: "$mandi",
          locationName: { $first: "$locationName" },
          coordinates: { $first: "$location.coordinates" },
          distance: { $first: "$distance" }
        }
      },
      { $sort: { distance: 1 } },
      { $limit: 10 }
    ]);

    res.json({
      success: true,
      count: mandis.length,
      data: mandis
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMandiPrices = async (req, res) => {
  try {
    const { crop, location, sort } = req.query;

    const filter = {};

    if (crop) filter.crop = crop;
    // Note: old 'location' was string, now we should check 'locationName' or generic
    if (location) filter.locationName = { $regex: location, $options: "i" };

    let query = MandiPrice.find(filter);

    // Sorting Logic
    if (sort === "price_desc") {
      query = query.sort({ pricePerQuintal: -1 });
    } else {
      query = query.sort({ date: -1 });
    }

    let prices = await query;

    // Add "isBestPrice" indicator if sorting by price
    // Note: Since we are just adding a flag, we might need to return plain objects
    if (sort === "price_desc" && prices.length > 0) {
      // Convert to plain objects to append property if generic Mongoose doc doesn't allow virtuals easily without schema change
      prices = prices.map((p, index) => ({
        ...p.toObject(),
        isBestPrice: index === 0 // Highest price is first
      }));
    }

    res.json({
      success: true,
      count: prices.length,
      data: prices
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
