const User = require("../models/User");
const CropListing = require("../models/Inventory"); // Assuming Inventory model for crops
const Deal = require("../models/Deal"); // Assuming Deal model for orders

exports.getStats = async (req, res) => {
    try {
        const totalFarmers = await User.countDocuments({ role: "farmer" });
        const totalBuyers = await User.countDocuments({ role: "buyer" });
        const activeListings = await CropListing.countDocuments({ status: "ACTIVE" });

        // Revenue calculation (total amount of completed deals)
        const completedDeals = await Deal.find({ status: "ACCEPTED" });
        const monthlyRevenue = completedDeals.reduce((sum, deal) => sum + (deal.currentOffer * deal.quantityKg || 0), 0);

        // Orders today
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const ordersToday = await Deal.countDocuments({ createdAt: { $gte: startOfDay } });

        res.status(200).json({
            success: true,
            stats: {
                totalFarmers,
                totalBuyers,
                activeListings,
                ordersToday,
                monthlyRevenue,
                reportedListings: 0, // Mock for now
                pendingApprovals: 0, // Mock for now
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getRecentActivities = async (req, res) => {
    try {
        const recentOrders = await Deal.find()
            .sort({ createdAt: -1 })
            .limit(5)
            .populate("buyer", "name")
            .populate("seller", "name");

        const recentUsers = await User.find()
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            success: true,
            activities: {
                orders: recentOrders.map(o => ({
                    id: o._id,
                    buyer: o.buyer?.name || "Unknown",
                    farmer: o.seller?.name || "Unknown",
                    crop: o.crop || "Produce",
                    amount: (o.currentOffer * o.quantityKg),
                    status: o.status.toLowerCase(),
                    date: o.createdAt
                })),
                registrations: recentUsers.map(u => ({
                    id: u._id,
                    name: u.name,
                    role: u.role,
                    location: u.location || "N/A"
                }))
            }
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAllOrders = async (req, res) => {
    try {
        const orders = await Deal.find()
            .sort({ createdAt: -1 })
            .populate("buyer", "name")
            .populate("seller", "name");

        res.status(200).json({
            success: true,
            orders: orders.map(o => ({
                id: o._id.toString().slice(-6).toUpperCase(),
                buyer: o.buyer?.name || "Unknown",
                farmer: o.seller?.name || "Unknown",
                total: (o.currentOffer * o.quantityKg),
                payStatus: "paid", // Placeholder if no payment model
                delStatus: o.status.toLowerCase(),
                date: new Date(o.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' })
            }))
        });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};

exports.getAnalytics = async (req, res) => {
    try {
        // 1. Revenue Growth (Last 6 Months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
        sixMonthsAgo.setDate(1);
        sixMonthsAgo.setHours(0, 0, 0, 0);

        const deals = await Deal.find({
            status: "ACCEPTED",
            createdAt: { $gte: sixMonthsAgo }
        });

        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const last6MonthsLabels = [];
        const revenueByMonth = {};

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(new Date().getMonth() - i);
            const label = months[d.getMonth()];
            last6MonthsLabels.push(label);
            revenueByMonth[label] = 0;
        }

        deals.forEach(deal => {
            const monthLabel = months[new Date(deal.createdAt).getMonth()];
            if (revenueByMonth.hasOwnProperty(monthLabel)) {
                revenueByMonth[monthLabel] += (deal.currentOffer * deal.quantityKg);
            }
        });

        const revenueData = last6MonthsLabels.map(label => revenueByMonth[label] / 1000); // In thousands for display

        // 2. Category Distribution
        const categories = await CropListing.aggregate([
            { $match: { status: "ACTIVE" } },
            { $group: { _id: "$category", count: { $sum: 1 } } }
        ]);

        const categoryColors = {
            "Grains": "#1B5E20",
            "Vegetables": "#81C784",
            "Fruits": "#3B82F6",
            "Spices": "#F59E0B",
            "Other": "#A1887F"
        };

        const categoryData = (categories.length > 0 ? categories : [{ _id: "Other", count: 0 }]).map(c => ({
            name: c._id || "Other",
            population: c.count,
            color: categoryColors[c._id] || "#64748B",
            legendFontColor: "#64748B",
            legendFontSize: 12
        }));

        // 3. Top Selling Products
        const topProducts = await Deal.aggregate([
            { $match: { status: "ACCEPTED" } },
            {
                $group: {
                    _id: "$crop",
                    sales: { $sum: { $multiply: ["$currentOffer", "$quantityKg"] } },
                    volume: { $sum: "$quantityKg" }
                }
            },
            { $sort: { sales: -1 } },
            { $limit: 3 }
        ]);

        res.status(200).json({
            success: true,
            analytics: {
                revenueGrowth: {
                    labels: last6MonthsLabels,
                    data: revenueData.length > 0 ? revenueData : [0, 0, 0, 0, 0, 0]
                },
                categoryDistribution: categoryData,
                topProducts: topProducts.map(p => ({
                    name: p._id,
                    sales: `₹${p.sales >= 100000 ? (p.sales / 100000).toFixed(1) + 'L' : (p.sales / 1000).toFixed(1) + 'k'}`,
                    volume: `${p.volume >= 1000 ? (p.volume / 1000).toFixed(1) + ' Tons' : p.volume + 'kg'}`
                }))
            }
        });

    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
};
