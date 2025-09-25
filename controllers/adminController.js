// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const Payout = require('../models/Payout');

// // @desc    Get platform-wide statistics for the admin dashboard
// // @route   GET /api/v1/admin/dashboard
// // @access  Private (Superadmin)
// const getAdminDashboard = asyncHandler(async (req, res) => {
//     const totalCreators = await User.countDocuments({ role: 'creator' });
//     const totalVideos = await Video.countDocuments();
    
//     // Calculate Gross Merchandise Volume (total money moved through the platform)
//     const grossRevenueAggregation = await Transaction.aggregate([
//         { $match: { status: 'successful' } },
//         { $group: { _id: null, total: { $sum: '$amountKobo' } } }
//     ]);
//     const totalGrossRevenueKobo = grossRevenueAggregation.length > 0 ? grossRevenueAggregation[0].total : 0;

//     // Calculate the platform's actual net revenue (profit from commissions)
//     const platformRevenueAggregation = await Transaction.aggregate([
//         { $match: { status: 'successful' } },
//         { $group: { _id: null, total: { $sum: '$commissionKobo' } } }
//     ]);
//     const totalPlatformProfitKobo = platformRevenueAggregation.length > 0 ? platformRevenueAggregation[0].total : 0;

//     const totalPayoutsAggregation = await Payout.aggregate([
//         { $match: { status: 'completed' } },
//         { $group: { _id: null, total: { $sum: '$amountKobo' } } }
//     ]);
//     const totalPayoutsKobo = totalPayoutsAggregation.length > 0 ? totalPayoutsAggregation[0].total : 0;
    
//     const pendingPayouts = await Payout.find({ status: 'pending' })
//         .populate('creator', 'userName email')
//         .sort({ createdAt: -1 })
//         .limit(10);

//     res.status(200).json({
//         totalCreators,
//         totalVideos,
//         totalGrossRevenueKobo,
//         totalPlatformProfitKobo,
//         totalPayoutsKobo,
//         pendingPayouts,
//     });
// });

// // @desc    Get detailed analytics for a single creator
// // @route   GET /api/v1/admin/creators/:id/details
// // @access  Private (Superadmin)
// const getCreatorDetails = asyncHandler(async (req, res) => {
//     const creatorId = new mongoose.Types.ObjectId(req.params.id);

//     const creator = await User.findById(creatorId).select('firstName lastName userName email createdAt');
//     if (!creator) {
//         res.status(404);
//         throw new Error('Creator not found');
//     }

//     // Run all data-gathering queries in parallel
//     const [financials, videos, payoutHistory] = await Promise.all([
//         // 1. Get financial stats
//         Transaction.aggregate([
//             { $match: { creator: creatorId, status: 'successful' } },
//             { 
//                 $group: { 
//                     _id: null,
//                     totalRevenueKobo: { $sum: '$creatorEarningsKobo' },
//                     platformEarningsFromCreatorKobo: { $sum: '$commissionKobo' }
//                 }
//             }
//         ]),
//         // 2. Get all videos and their individual sales data
//         Video.aggregate([
//             { $match: { creator: creatorId } },
//             {
//                 $lookup: {
//                     from: 'transactions',
//                     localField: '_id',
//                     foreignField: 'video',
//                     as: 'sales'
//                 }
//             },
//             {
//                 $project: {
//                     title: 1,
//                     priceKobo: 1,
//                     createdAt: 1,
//                     totalSales: { $size: { $filter: { input: '$sales', as: 'sale', cond: { $eq: ['$$sale.status', 'successful'] } } } },
//                     totalRevenueKobo: { $sum: { $map: { input: { $filter: { input: '$sales', as: 'sale', cond: { $eq: ['$$sale.status', 'successful'] } } }, as: 'sale', in: '$$sale.creatorEarningsKobo' } } }
//                 }
//             }
//         ]),
//         // 3. Get payout history
//         Payout.find({ creator: creatorId }).sort({ createdAt: -1 })
//     ]);

//     res.status(200).json({
//         profile: creator,
//         financials: financials[0] || { totalRevenueKobo: 0, platformEarningsFromCreatorKobo: 0 },
//         videos,
//         payoutHistory
//     });
// });

// // @desc    Get all payouts, filterable by status
// // @route   GET /api/v1/admin/payouts
// // @access  Private (Superadmin)
// const getPayouts = asyncHandler(async (req, res) => {
//     const { status } = req.query;
//     const query = status ? { status } : {};
    
//     const payouts = await Payout.find(query)
//         .populate('creator', 'userName email')
//         .sort({ createdAt: -1 });

//     res.status(200).json(payouts);
// });

// // @desc    Approve a pending payout
// // @route   PUT /api/v1/admin/payouts/:id/approve
// // @access  Private (Superadmin)
// const approvePayout = asyncHandler(async (req, res) => {
//     const payout = await Payout.findById(req.params.id);
//     if (!payout) {
//         res.status(404);
//         throw new Error('Payout not found');
//     }
//     if (payout.status !== 'pending') {
//         res.status(400);
//         throw new Error(`Payout is already in '${payout.status}' state and cannot be approved.`);
//     }

//     // This implies the admin has sent the money outside the app (manual process).
//     payout.status = 'completed';
//     payout.processedBy = req.user.id;
//     payout.processedAt = new Date();
//     payout.notes = req.body.notes || 'Manually approved and paid.';

//     const updatedPayout = await payout.save();
//     res.status(200).json(updatedPayout);
// });

// // @desc    Reject a pending payout
// // @route   PUT /api/v1/admin/payouts/:id/reject
// // @access  Private (Superadmin)
// const rejectPayout = asyncHandler(async (req, res) => {
//     const { reason } = req.body;
//     if (!reason) {
//         res.status(400);
//         throw new Error('A reason for rejection is required.');
//     }

//     const payout = await Payout.findById(req.params.id);
//     if (!payout) {
//         res.status(404);
//         throw new Error('Payout not found');
//     }
//     if (payout.status !== 'pending') {
//         res.status(400);
//         throw new Error(`Payout is already in '${payout.status}' state and cannot be rejected.`);
//     }

//     payout.status = 'rejected';
//     payout.processedBy = req.user.id;
//     payout.processedAt = new Date();
//     payout.notes = reason;

//     const updatedPayout = await payout.save();
//     res.status(200).json(updatedPayout);
// });

// // @desc    Get a list of all users (creators)
// // @route   GET /api/v1/admin/users
// // @access  Private (Superadmin)
// const getAllUsers = asyncHandler(async (req, res) => {
//     const pageSize = 20;
//     const page = Number(req.query.pageNumber) || 1;
//     const count = await User.countDocuments({ role: 'creator' });
//     const users = await User.find({ role: 'creator' })
//         .select('userName email status createdAt lastLogin')
//         .limit(pageSize)
//         .skip(pageSize * (page - 1))
//         .sort({ createdAt: -1 });

//     res.json({ users, page, pages: Math.ceil(count / pageSize) });
// });

// // @desc    Update a user's status (e.g., suspend or activate)
// // @route   PUT /api/v1/admin/users/:id/status
// // @access  Private (Superadmin)
// const updateUserStatus = asyncHandler(async (req, res) => {
//     const { status } = req.body;
//     const validStatuses = ['active', 'inactive', 'suspended'];
//     if (!validStatuses.includes(status)) {
//         res.status(400);
//         throw new Error('Invalid status provided.');
//     }
//     const user = await User.findById(req.params.id);
//     if (user) {
//         user.status = status;
//         await user.save();
//         res.json({ _id: user._id, userName: user.userName, status: user.status });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// module.exports = {
//     getAdminDashboard,
//     getPayouts,
//     approvePayout,
//     rejectPayout,
//     getAllUsers,
//     updateUserStatus,
//     getCreatorDetails,
// };



const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');

// @desc    Get platform-wide statistics for the admin dashboard
// @route   GET /api/v1/admin/dashboard
// @access  Private (Superadmin)
const getAdminDashboard = asyncHandler(async (req, res) => {
    const totalCreators = await User.countDocuments({ role: 'creator' });
    const totalVideos = await Video.countDocuments();
    
    // Calculate Gross Merchandise Volume (total money moved through the platform)
    const grossRevenueAggregation = await Transaction.aggregate([
        { $match: { status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const totalGrossRevenueKobo = grossRevenueAggregation.length > 0 ? grossRevenueAggregation[0].total : 0;

    // Calculate the platform's actual net revenue (profit from commissions)
    const platformRevenueAggregation = await Transaction.aggregate([
        { $match: { status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$commissionKobo' } } }
    ]);
    const totalPlatformProfitKobo = platformRevenueAggregation.length > 0 ? platformRevenueAggregation[0].total : 0;

    const totalPayoutsAggregation = await Payout.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const totalPayoutsKobo = totalPayoutsAggregation.length > 0 ? totalPayoutsAggregation[0].total : 0;
    
    const pendingPayouts = await Payout.find({ status: 'pending' })
        .populate('creator', 'userName email')
        .sort({ createdAt: -1 })
        .limit(10);

    res.status(200).json({
        totalCreators,
        totalVideos,
        totalGrossRevenueKobo,
        totalPlatformProfitKobo,
        totalPayoutsKobo,
        pendingPayouts,
    });
});

// @desc    Get detailed analytics for a single creator
// @route   GET /api/v1/admin/creators/:id/details
// @access  Private (Superadmin)
const getCreatorDetails = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.params.id);

    const creator = await User.findById(creatorId).select('firstName lastName userName email createdAt');
    if (!creator) {
        res.status(404);
        throw new Error('Creator not found');
    }

    // Run all data-gathering queries in parallel
    const [financials, videos, payoutHistory] = await Promise.all([
        // 1. Get financial stats
        Transaction.aggregate([
            { $match: { creator: creatorId, status: 'successful' } },
            { 
                $group: { 
                    _id: null,
                    totalRevenueKobo: { $sum: '$creatorEarningsKobo' },
                    platformEarningsFromCreatorKobo: { $sum: '$commissionKobo' }
                }
            }
        ]),
        
        // 2. Get all videos and their individual sales data
        Video.aggregate([
            { $match: { creator: creatorId } },
            {
                $lookup: {
                    from: 'transactions',
                    let: { videoId: '$_id' },
                    pipeline: [
                        { 
                            $match: {
                                $expr: {
                                    $and: [
                                        { $eq: ['$video', '$$videoId'] },
                                        { $eq: ['$status', 'successful'] }
                                    ]
                                }
                            }
                        }
                    ],
                    as: 'sales'
                }
            },
            // --- THIS IS THE CORRECTED AGGREGATION STAGE ---
            {
                $project: {
                    title: 1,
                    priceKobo: 1,
                    createdAt: 1,
                    totalSales: { $size: '$sales' },
                    totalRevenueKobo: { $sum: '$sales.creatorEarningsKobo' }
                }
            }
        ]),
        
        // 3. Get payout history
        Payout.find({ creator: creatorId }).sort({ createdAt: -1 })
    ]);

    res.status(200).json({
        profile: creator,
        financials: financials[0] || { totalRevenueKobo: 0, platformEarningsFromCreatorKobo: 0 },
        videos,
        payoutHistory
    });
});


// @desc    Get all payouts, filterable by status
// @route   GET /api/v1/admin/payouts
// @access  Private (Superadmin)
const getPayouts = asyncHandler(async (req, res) => {
    const { status } = req.query;
    const query = status ? { status } : {};
    
    const payouts = await Payout.find(query)
        .populate('creator', 'userName email')
        .sort({ createdAt: -1 });

    res.status(200).json(payouts);
});

// @desc    Approve a pending payout
// @route   PUT /api/v1/admin/payouts/:id/approve
// @access  Private (Superadmin)
const approvePayout = asyncHandler(async (req, res) => {
    const payout = await Payout.findById(req.params.id);
    if (!payout) {
        res.status(404);
        throw new Error('Payout not found');
    }
    if (payout.status !== 'pending') {
        res.status(400);
        throw new Error(`Payout is already in '${payout.status}' state and cannot be approved.`);
    }

    payout.status = 'completed';
    payout.processedBy = req.user.id;
    payout.processedAt = new Date();
    payout.notes = req.body.notes || 'Manually approved and paid.';

    const updatedPayout = await payout.save();
    res.status(200).json(updatedPayout);
});

// @desc    Reject a pending payout
// @route   PUT /api/v1/admin/payouts/:id/reject
// @access  Private (Superadmin)
const rejectPayout = asyncHandler(async (req, res) => {
    const { reason } = req.body;
    if (!reason) {
        res.status(400);
        throw new Error('A reason for rejection is required.');
    }

    const payout = await Payout.findById(req.params.id);
    if (!payout) {
        res.status(404);
        throw new Error('Payout not found');
    }
    if (payout.status !== 'pending') {
        res.status(400);
        throw new Error(`Payout is already in '${payout.status}' state and cannot be rejected.`);
    }

    payout.status = 'rejected';
    payout.processedBy = req.user.id;
    payout.processedAt = new Date();
    payout.notes = reason;

    const updatedPayout = await payout.save();
    res.status(200).json(updatedPayout);
});

// @desc    Get a list of all users (creators)
// @route   GET /api/v1/admin/users
// @access  Private (Superadmin)
const getAllUsers = asyncHandler(async (req, res) => {
    const pageSize = 20;
    const page = Number(req.query.pageNumber) || 1;
    const count = await User.countDocuments({ role: 'creator' });
    const users = await User.find({ role: 'creator' })
        .select('userName email status createdAt lastLogin')
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .sort({ createdAt: -1 });

    res.json({ users, page, pages: Math.ceil(count / pageSize) });
});

// @desc    Update a user's status (e.g., suspend or activate)
// @route   PUT /api/v1/admin/users/:id/status
// @access  Private (Superadmin)
const updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) {
        res.status(400);
        throw new Error('Invalid status provided.');
    }
    const user = await User.findById(req.params.id);
    if (user) {
        user.status = status;
        await user.save();
        res.json({ _id: user._id, userName: user.userName, status: user.status });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});

module.exports = {
    getAdminDashboard,
    getPayouts,
    approvePayout,
    rejectPayout,
    getAllUsers,
    updateUserStatus,
    getCreatorDetails,
};