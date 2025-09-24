// const asyncHandler = require('express-async-handler');
// const User = require('../models/User');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const Payout = require('../models/Payout');

// // @desc    Get platform-wide statistics for the admin dashboard
// // @route   GET /api/admin/dashboard
// // @access  Private (Superadmin)
// const getAdminDashboard = asyncHandler(async (req, res) => {
//     // ... (This function remains the same as previously defined)
//     const totalUsers = await User.countDocuments({ role: 'creator' });
//     const totalVideos = await Video.countDocuments();
//     const revenueAggregation = await Transaction.aggregate([ { $match: { status: 'successful' } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalPlatformRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
//     const payoutAggregation = await Payout.aggregate([ { $match: { status: 'completed' } }, { $group: { _id: null, total: { $sum: '$amountKobo' } } } ]);
//     const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
//     const pendingPayouts = await Payout.find({ status: 'pending' }).populate('creator', 'displayName email').sort({ createdAt: -1 }).limit(10);
//     res.status(200).json({ totalUsers, totalVideos, totalPlatformRevenueKobo, totalPayoutsKobo, platformBalanceKobo: totalPlatformRevenueKobo - totalPayoutsKobo, pendingPayouts });
// });

// // @desc    Approve a pending payout
// // @route   PUT /api/admin/payouts/:id/approve
// // @access  Private (Superadmin)
// const approvePayout = asyncHandler(async (req, res) => {
//     // ... (This function remains the same as previously defined)
//     const payout = await Payout.findById(req.params.id);
//     if (!payout) { res.status(404); throw new Error('Payout not found'); }
//     if (payout.status !== 'pending') { res.status(400); throw new Error(`Payout is already in '${payout.status}' state.`); }
//     payout.status = 'completed';
//     payout.approvedBy = req.user._id;
//     payout.processedAt = new Date();
//     const updatedPayout = await payout.save();
//     res.status(200).json(updatedPayout);
// });

// // @desc    Get a list of all users (creators)
// // @route   GET /api/admin/users
// // @access  Private (Superadmin)
// const getAllUsers = asyncHandler(async (req, res) => {
//     const pageSize = 20;
//     const page = Number(req.query.pageNumber) || 1;

//     const count = await User.countDocuments({ role: 'creator' });
//     const users = await User.find({ role: 'creator' })
//         .select('displayName email status createdAt lastLogin')
//         .limit(pageSize)
//         .skip(pageSize * (page - 1))
//         .sort({ createdAt: -1 });

//     res.json({ users, page, pages: Math.ceil(count / pageSize) });
// });

// // @desc    Update a user's status (e.g., suspend or activate)
// // @route   PUT /api/admin/users/:id/status
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
//         const updatedUser = await user.save();
//         res.json({
//             _id: updatedUser._id,
//             displayName: updatedUser.displayName,
//             status: updatedUser.status,
//         });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// module.exports = {
//     getAdminDashboard,
//     approvePayout,
//     getAllUsers,
//     updateUserStatus,
// };


const asyncHandler = require('express-async-handler');
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

    // This implies the admin has sent the money outside the app (manual process).
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
};