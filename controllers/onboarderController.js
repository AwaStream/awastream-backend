const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Transaction = require('../models/Transaction');

/**
 * @desc    Get dashboard metrics for the logged-in onboarder
 * @route   GET /api/v1/onboarder/dashboard
 * @access  Private (Onboarder)
 */
const getOnboarderDashboard = asyncHandler(async (req, res) => {
    const onboarderId = new mongoose.Types.ObjectId(req.user.id);

    // 1. Find all creators referred by this onboarder
    const referredCreators = await User.find({ referredBy: onboarderId })
        .select('firstName lastName userName createdAt')
        .sort({ createdAt: -1 });
    
    const referredCreatorIds = referredCreators.map(c => c._id);

    // 2. Aggregate sales data from those creators
    const salesAggregation = await Transaction.aggregate([
        { $match: { creator: { $in: referredCreatorIds }, status: 'successful' } },
        { 
            $group: { 
                _id: null, 
                totalSalesVolumeKobo: { $sum: '$amountKobo' },
                totalTransactions: { $sum: 1 }
            }
        }
    ]);

    const stats = salesAggregation[0] || { totalSalesVolumeKobo: 0, totalTransactions: 0 };

    // 3. Calculate commission (assuming 15% platform fee, 20% commission rate)
    const PLATFORM_FEE_RATE = 0.15;
    const ONBOARDER_COMMISSION_RATE = 0.20;

    const platformRevenueKobo = stats.totalSalesVolumeKobo * PLATFORM_FEE_RATE;
    const onboarderCommissionKobo = platformRevenueKobo * ONBOARDER_COMMISSION_RATE;
    
    // 4. (Optional but Recommended) Get payout history for the onboarder
    // const payoutHistory = await Payout.find({ creator: onboarderId }).sort({ createdAt: -1 });
// Correct response structure ✅
res.status(200).json({
    stats: {
        referredCreatorCount: referredCreators.length,
        totalSalesVolumeKobo: stats.totalSalesVolumeKobo,
        totalTransactions: stats.totalTransactions,
        onboarderCommissionKobo,
    },
    referredCreators,
    // payoutHistory: payoutHistory || [],
});
    
});

module.exports = { getOnboarderDashboard };