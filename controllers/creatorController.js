// const asyncHandler = require('express-async-handler');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const Payout = require('../models/Payout');
// const User = require('../models/User');

// // @desc    Get statistics for the logged-in creator's dashboard
// // @route   GET /api/creator/dashboard
// // @access  Private (Creator)
// const getCreatorDashboard = asyncHandler(async (req, res) => {
//     const creatorId = req.user._id;
//     const videos = await Video.find({ creator: creatorId });
//     const videoIds = videos.map(v => v._id);
//     const revenueAggregation = await Transaction.aggregate([ { $match: { video: { $in: videoIds }, status: 'successful' } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
//     const payoutAggregation = await Payout.aggregate([ { $match: { creator: creatorId, status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
//     const totalSales = await Transaction.countDocuments({ video: { $in: videoIds }, status: 'successful' });
//     res.status(200).json({ totalRevenueKobo, totalPayoutsKobo, availableBalanceKobo: totalRevenueKobo - totalPayoutsKobo, totalSales, monetizedVideosCount: videos.length, recentVideos: videos.slice(0, 5) });
// });

// // @desc    Get the logged-in creator's profile
// // @route   GET /api/creator/profile
// // @access  Private (Creator)
// const getCreatorProfile = asyncHandler(async (req, res) => {
//     const creator = await User.findById(req.user._id).select('displayName email avatarUrl payout_bank_name payout_account_number payout_account_name');
//     if (creator) {
//         res.json(creator);
//     } else {
//         res.status(404);
//         throw new Error('Creator profile not found');
//     }
// });

// // @desc    Update the logged-in creator's profile (payout info, etc.)
// // @route   PUT /api/creator/profile
// // @access  Private (Creator)
// const updateCreatorProfile = asyncHandler(async (req, res) => {
//     const creator = await User.findById(req.user._id);

//     if (creator) {
//         creator.displayName = req.body.displayName || creator.displayName;
//         // Add payout info if provided
//         creator.payout_bank_name = req.body.payout_bank_name || creator.payout_bank_name;
//         creator.payout_account_number = req.body.payout_account_number || creator.payout_account_number;
//         creator.payout_account_name = req.body.payout_account_name || creator.payout_account_name;
        
//         const updatedCreator = await creator.save();
//         res.json({
//             _id: updatedCreator._id,
//             displayName: updatedCreator.displayName,
//             email: updatedCreator.email,
//             // return updated payout info
//         });
//     } else {
//         res.status(404);
//         throw new Error('Creator not found');
//     }
// });

// // @desc    Create a new payout request
// // @route   POST /api/creator/payouts
// // @access  Private (Creator)
// const requestPayout = asyncHandler(async (req, res) => {
//     const { amountKobo } = req.body;
//     const creatorId = req.user._id;

//     if (!amountKobo || amountKobo <= 0) {
//         res.status(400);
//         throw new Error('A valid payout amount is required.');
//     }
    
//     // Recalculate available balance to ensure it's up to date
//     const revenueAggregation = await Transaction.aggregate([ { $match: { video: { $in: (await Video.find({ creator: creatorId })).map(v => v._id) }, status: 'successful' } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
//     const payoutAggregation = await Payout.aggregate([ { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
//     const availableBalanceKobo = totalRevenueKobo - totalPayoutsKobo;

//     if (amountKobo > availableBalanceKobo) {
//         res.status(400);
//         throw new Error('Payout request exceeds available balance.');
//     }
    
//     const payout = await Payout.create({
//         creator: creatorId,
//         amountKobo,
//         status: 'pending',
//     });

//     // TODO: createNotification for admin about new payout request

//     res.status(201).json(payout);
// });

// module.exports = {
//     getCreatorDashboard,
//     getCreatorProfile,
//     updateCreatorProfile,
//     requestPayout,
// };



















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