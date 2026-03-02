const { GoogleGenAI } = require("@google/genai");
const MandiPrice = require("../models/MandiPrice");
const AnalyticsCache = require("../models/AnalyticsCache"); // New Cache Layer

/**
 * @desc Get Price Forecast and Recommendation using Google Gemini (LLM)
 * @route GET /api/analytics/price-forecast
 */
exports.getPriceForecast = async (req, res) => {
    try {
        let { crop, mandi, days = 7 } = req.query;

        if (!crop || !mandi) {
            return res.status(400).json({ success: false, message: "Crop and Mandi are required parameters" });
        }

        // --- CACHE LAYER CHECK ---
        const todayStr = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"
        const existingCache = await AnalyticsCache.findOne({
            crop: crop.toLowerCase(),
            mandi: mandi.toLowerCase(),
            dateCached: todayStr
        });

        if (existingCache) {
            console.log(`[Cache Hit] Returning instant cached LLM data for ${crop} in ${mandi}`);
            return res.status(200).json({
                success: true,
                data: {
                    crop,
                    mandi,
                    historical: existingCache.historical,
                    predicted: existingCache.predicted,
                    recommendation: existingCache.recommendation
                }
            });
        }
        // --- END CACHE CHECK ---

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return res.status(500).json({
                success: false,
                message: "GEMINI_API_KEY is missing in your .env file. The LLM Prediction Engine requires this key to function."
            });
        }

        // Initialize Gemini
        const ai = new GoogleGenAI({ apiKey: apiKey });

        const prompt = `You are an expert AI agricultural commodities analyst in India.
The user is requesting highly realistic historical and predicted wholesale prices for '${crop}' in '${mandi}' mandi.
You MUST use your Google Search tool to find the most recent, real-world prices for this exact crop in this exact region before forecasting. Do not hallucinate. Ground your predictions in real search results.

CRITICAL RULES:
1. Prices MUST be in INR (₹) per Quintal (100kg).
2. Historical data must cover exactly the last 7 days ending yesterday. Base this heavily on your search results.
3. Predicted data must cover exactly the next ${days} days starting today.
4. Provide a professional, probabilistic selling recommendation (e.g., "We project a potential peak..."). Ensure you do not speak with 100% certainty.

Respond ONLY with a valid JSON object matching this exact schema:
{
  "historical": [
    { "date": "YYYY-MM-DD", "price": 1850.50 }
  ],
  "predicted": [
    { "date": "YYYY-MM-DD", "price": 1865.00 }
  ],
  "recommendation": "Your probabilistic advisory string here."
}`;

        // Call the LLM to synthesize data on the fly, using Google Search to ground it in reality
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                tools: [{ googleSearch: {} }] // Add Google Search Grounding to prevent hallucinations
            }
        });

        let aiData;
        try {
            // Strip any markdown codeblock formatting if the LLM includes it
            let rawText = response.text.replace(/```json/gi, "").replace(/```/g, "").trim();
            aiData = JSON.parse(rawText);
        } catch (e) {
            throw new Error("Failed to parse LLM JSON format.");
        }

        // Check if DB caching is desired (Optional: save history to MongoDB)
        // Since it's fully generated, this is mostly so the app doesn't break if other routes query DB
        try {
            await MandiPrice.deleteMany({ crop: crop.toLowerCase(), mandi: mandi });
            // Optionally insert the newly generated history so other parts of the app have localized records
            const records = aiData.historical.map(h => ({
                crop: crop.toLowerCase(),
                mandi: mandi,
                locationName: mandi,
                location: { type: "Point", coordinates: [0, 0] },
                pricePerQuintal: h.price,
                date: new Date(h.date)
            }));
            await MandiPrice.insertMany(records);

            // SAVE TO FAST-CACHE FOR 24 HOURS
            await AnalyticsCache.create({
                crop: crop.toLowerCase(),
                mandi: mandi.toLowerCase(),
                dateCached: todayStr,
                historical: aiData.historical,
                predicted: aiData.predicted,
                recommendation: aiData.recommendation
            });

        } catch (dbErr) {
            console.log("Could not cache LLM data to DB:", dbErr.message);
        }

        res.status(200).json({
            success: true,
            data: {
                crop,
                mandi,
                historical: aiData.historical,
                predicted: aiData.predicted,
                recommendation: aiData.recommendation
            }
        });

    } catch (err) {
        console.error("LLM Analytics Error:", err);
        res.status(500).json({
            success: false,
            error: "Predictive Analytics Engine Failed",
            details: err.message
        });
    }
};
