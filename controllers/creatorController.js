const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const User = require('../models/User');

// @desc    Get statistics for the logged-in creator's dashboard
// @route   GET /api/v1/creator/dashboard
// @access  Private (Creator)
const getCreatorDashboard = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    // --- FIX: Calculate revenue from the creator's actual net earnings ---
    const revenueAggregation = await Transaction.aggregate([
        { $match: { creator: creatorId, status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
    ]);
    const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    // --- FIX: Subtract all non-failed payouts to get an accurate available balance ---
    const payoutAggregation = await Payout.aggregate([
        { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;

    const totalSales = await Transaction.countDocuments({ creator: creatorId, status: 'successful' });
    const monetizedVideosCount = await Video.countDocuments({ creator: creatorId });

    // --- FIX: Efficiently query for only the 5 most recent videos ---
    const recentVideos = await Video.find({ creator: creatorId }).sort({ createdAt: -1 }).limit(5);

    res.status(200).json({
        totalRevenueKobo,
        totalPayoutsKobo,
        availableBalanceKobo: totalRevenueKobo - totalPayoutsKobo,
        totalSales,
        monetizedVideosCount,
        recentVideos,
    });
});

// @desc    Get the logged-in creator's profile
// @route   GET /api/v1/creator/profile
// @access  Private (Creator)
const getCreatorProfile = asyncHandler(async (req, res) => {
    // --- FIX: Use correct camelCase field names to match the User model ---
    const creator = await User.findById(req.user.id).select('userName email avatarUrl payoutBankName payoutAccountNumber payoutAccountName');
    
    if (creator) {
        res.json(creator);
    } else {
        res.status(404);
        throw new Error('Creator profile not found');
    }
});

// @desc    Update the logged-in creator's profile (payout info, etc.)
// @route   PUT /api/v1/creator/profile
// @access  Private (Creator)
const updateCreatorProfile = asyncHandler(async (req, res) => {
    const { payoutBankName, payoutAccountNumber, payoutAccountName } = req.body;

    // --- FIX: Use findByIdAndUpdate for a cleaner update and use correct camelCase names ---
    const updatedCreator = await User.findByIdAndUpdate(
        req.user.id,
        { payoutBankName, payoutAccountNumber, payoutAccountName },
        { new: true, runValidators: true } // Options to return the new doc and run schema validators
    ).select('-passwordHash'); // Exclude password from the response

    if (updatedCreator) {
        res.json(updatedCreator);
    } else {
        res.status(404);
        throw new Error('Creator not found');
    }
});

// @desc    Create a new payout request
// @route   POST /api/v1/creator/payouts
// @access  Private (Creator)
const requestPayout = asyncHandler(async (req, res) => {
    const { amountKobo } = req.body;
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    if (!amountKobo || amountKobo <= 0) {
        res.status(400);
        throw new Error('A valid payout amount is required.');
    }

    // --- FIX: Add validation to ensure bank details are complete ---
    const creator = await User.findById(creatorId);
    if (!creator || !creator.payoutBankName || !creator.payoutAccountNumber || !creator.payoutAccountName) {
        res.status(400);
        throw new Error('Please complete your bank details in your profile before requesting a payout.');
    }

    // --- FIX: Re-calculate balance using the corrected logic (net earnings, all payouts) ---
    const revenueRes = await Transaction.aggregate([ { $match: { creator: creatorId, status: 'successful' } }, { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } } ]);
    const payoutRes = await Payout.aggregate([ { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
    const totalRevenueKobo = revenueRes.length > 0 ? revenueRes[0].total : 0;
    const totalPayoutsKobo = payoutRes.length > 0 ? payoutRes[0].total : 0;
    const availableBalanceKobo = totalRevenueKobo - totalPayoutsKobo;

    if (amountKobo > availableBalanceKobo) {
        res.status(400);
        throw new Error('Payout request exceeds your available balance.');
    }

    const payout = await Payout.create({
        creator: creatorId,
        amountKobo,
        status: 'pending',
    });

    res.status(201).json(payout);
});

module.exports = {
    getCreatorDashboard,
    getCreatorProfile,
    updateCreatorProfile,
    requestPayout,
};