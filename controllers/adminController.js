const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const User = require('../models/User');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const payoutService = require('../services/payoutService');
const Payout = require('../models/Payout');


function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
}

// @desc    Get platform-wide statistics for the admin dashboard
// @route   GET /api/v1/admin/dashboard
// @access  Private (Superadmin)
const getAdminDashboard = asyncHandler(async (req, res) => {
    const totalUsers = await User.countDocuments();
    const totalCreators = await User.countDocuments({ role: 'creator' });
    const totalViewers = await User.countDocuments({ role: 'viewer' });
    const totalOnboarders = await User.countDocuments({ role: 'onboarder' });
    const totalVideos = await Video.countDocuments();
    
    const grossRevenueAggregation = await Transaction.aggregate([
        { $match: { status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const totalGrossRevenueKobo = grossRevenueAggregation.length > 0 ? grossRevenueAggregation[0].total : 0;

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
        totalUsers,
        totalCreators,
        totalViewers,
        totalOnboarders,
        totalVideos,
        totalGrossRevenueKobo,
        totalPlatformProfitKobo,
        totalPayoutsKobo,
        pendingPayouts,
    });
});

// @desc    Get a list of all viewers
// @route   GET /api/v1/admin/viewers
// @access  Private (Superadmin)
const getAllViewers = asyncHandler(async (req, res) => {
    const viewers = await User.aggregate([
        { $match: { role: 'viewer' } },
        { $sort: { createdAt: -1 } },
        {
            $lookup: {
                from: 'transactions',
                localField: '_id',
                foreignField: 'viewer',
                as: 'purchaseHistory'
            }
        },
        {
            $project: {
                userName: 1,
                email: 1,
                status: 1,
                createdAt: 1,
                purchaseCount: { $size: '$purchaseHistory' },
                lastPurchaseDate: { $max: '$purchaseHistory.createdAt' }
            }
        }
    ]);
    res.status(200).json(viewers);
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

    const [financials, videos, payoutHistory] = await Promise.all([
        Transaction.aggregate([
            { $match: { creator: creatorId, status: 'successful' } },
            { $group: { _id: null, totalRevenueKobo: { $sum: '$creatorEarningsKobo' }, platformEarningsFromCreatorKobo: { $sum: '$commissionKobo' } } }
        ]),
        Video.aggregate([
            { $match: { creator: creatorId } },
            {
                $lookup: {
                    from: 'transactions',
                    let: { videoId: '$_id' },
                    pipeline: [
                        { $match: { $expr: { $and: [ { $eq: ['$video', '$$videoId'] }, { $eq: ['$status', 'successful'] } ] } } },
                        { $lookup: { from: 'users', localField: 'viewer', foreignField: '_id', as: 'viewerDetails' } },
                        { $unwind: '$viewerDetails' }
                    ],
                    as: 'sales'
                }
            },
            {
                $project: {
                    title: 1, priceKobo: 1, createdAt: 1, totalSales: { $size: '$sales' },
                    totalRevenueKobo: { $sum: '$sales.creatorEarningsKobo' },
                    purchasingViewers: {
                        $map: {
                            input: '$sales', as: 'sale',
                            in: { email: '$$sale.viewerDetails.email', userName: '$$sale.viewerDetails.userName', purchasedAt: '$$sale.createdAt' }
                        }
                    }
                }
            }
        ]),
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
    
    const payouts = await Payout.find(query).populate('creator', 'userName email').sort({ createdAt: -1 });
    res.status(200).json(payouts);
});

// @desc    Approve a pending payout
// @route   PUT /api/v1/admin/payouts/:id/approve
// @access  Private (Superadmin)
const approvePayout = asyncHandler(async (req, res) => {
    const payout = await Payout.findById(req.params.id);
    if (!payout) { res.status(404); throw new Error('Payout not found'); }
    if (payout.status !== 'pending') { res.status(400); throw new Error(`Payout is already in '${payout.status}' state.`); }

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
    if (!reason) { res.status(400); throw new Error('A reason for rejection is required.'); }

    const payout = await Payout.findById(req.params.id);
    if (!payout) { res.status(404); throw new Error('Payout not found'); }
    if (payout.status !== 'pending') { res.status(400); throw new Error(`Payout is already in '${payout.status}' state.`); }

    payout.status = 'rejected';
    payout.processedBy = req.user.id;
    payout.processedAt = new Date();
    payout.notes = reason;
    const updatedPayout = await payout.save();
    res.status(200).json(updatedPayout);
});


// @desc    Verify a payout status manually via Provider API
// @route   PUT /api/v1/admin/payouts/:id/verify
// @access  Private (Admin)
const verifyPayoutStatus = asyncHandler(async (req, res) => {
    const payoutId = req.params.id;
    const payout = await Payout.findById(payoutId);

    if (!payout) {
        res.status(404);
        throw new Error('Payout not found');
    }

    // Since this is an admin route, we don't need to check if req.user.id matches creator
    
    if (payout.status === 'successful' || payout.status === 'failed') {
        return res.json({ message: 'Payout is already finalized', payout });
    }

    try {
        // Call the service to check the provider
        const verification = await payoutService.verifyTransfer(payoutId);
        
        if (verification && verification.status) {
            if (verification.status === 'successful') {
                payout.status = 'successful';
                payout.processedAt = new Date();
                payout.notes = 'Verified manually by Admin';
                await payout.save();
            } else if (verification.status === 'failed') {
                payout.status = 'failed';
                payout.notes = 'Verification returned failed status';
                await payout.save();
            }
        }

        res.json({ 
            message: 'Payout verification attempt complete', 
            payout 
        });

    } catch (error) {
        console.error("Admin Payout Verification Failed:", error);
        res.status(400).json({ message: 'Could not verify payout status at this time.' });
    }
});

// @desc    Update a user's status
// @route   PUT /api/v1/admin/users/:id/status
// @access  Private (Superadmin)
const updateUserStatus = asyncHandler(async (req, res) => {
    const { status } = req.body;
    const validStatuses = ['active', 'inactive', 'suspended'];
    if (!validStatuses.includes(status)) { res.status(400); throw new Error('Invalid status provided.'); }

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


/**
 * @desc    Get all users with the 'onboarder' role.
 * @route   GET /api/v1/admin/onboarders
 * @access  Private (Superadmin)
 */
const getOnboarders = asyncHandler(async (req, res) => {
    const onboarders = await User.find({ role: 'onboarder' })
        .select('firstName lastName userName email createdAt')
        .sort({ createdAt: -1 });
    res.status(200).json(onboarders);
});

const getOnboarderDetails = asyncHandler(async (req, res) => {
    const onboarderId = new mongoose.Types.ObjectId(req.params.id);
    // The fix is applied here 👇
    const onboarder = await User.findById(onboarderId).select('firstName lastName userName email role'); 
    
    if (!onboarder || onboarder.role !== 'onboarder') {
        res.status(404);
        throw new Error('Onboarder not found.');
    }

    const referredCreators = await User.find({ referredBy: onboarderId }).select('_id userName firstName lastName');
    const referredCreatorIds = referredCreators.map(c => c._id);

    const salesAggregation = await Transaction.aggregate([
        { $match: { creator: { $in: referredCreatorIds }, status: 'successful' } },
        { $group: { 
            _id: null, 
            totalSalesValueKobo: { $sum: '$amountKobo' },
            totalTransactions: { $sum: 1 }
        }}
    ]);
    const stats = salesAggregation[0] || { totalSalesValueKobo: 0, totalTransactions: 0 };

    res.status(200).json({
        onboarder,
        referredCreators,
        stats: {
            referredCreatorCount: referredCreators.length,
            totalSalesValueKobo: stats.totalSalesValueKobo,
            totalTransactions: stats.totalTransactions,
        }
    });
});


/**
 * @desc    Update a user's role (e.g., promote to 'onboarder').
 * @route   PUT /api/v1/admin/users/:id/role
 * @access  Private (Superadmin)
 */
const updateUserRole = asyncHandler(async (req, res) => {
    const { role } = req.body;
    const validRoles = ['creator', 'viewer', 'onboarder', 'superadmin'];
    if (!role || !validRoles.includes(role)) {
        res.status(400);
        throw new Error('A valid role is required.');
    }
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('firstName lastName userName email role');
    if (!user) {
        res.status(404);
        throw new Error('User not found.');
    }
    res.status(200).json(user);
});

/**
 * @desc    Get a paginated list of all users (creators & viewers)
 * @route   GET /api/v1/admin/users
 * @access  Private (Superadmin)
 */
const getAllUsers = asyncHandler(async (req, res) => {
    const pageSize = 20;
    const page = Number(req.query.pageNumber) || 1;
    
    // Build the query object
    const query = { role: { $in: ['creator', 'viewer', 'onboarder'] } }; // Exclude other superadmins
    
    if (req.query.keyword) {
        const escapedKeyword = escapeRegExp(req.query.keyword);
        const keyword = { $regex: escapedKeyword, $options: 'i' }; 
        query.$or = [ { firstName: keyword }, { lastName: keyword }, { userName: keyword }, { email: keyword } ];
    }
    
    const count = await User.countDocuments(query);
    const users = await User.find(query)
        .select('firstName lastName userName email role status createdAt')
        .limit(pageSize)
        .skip(pageSize * (page - 1))
        .sort({ createdAt: -1 });
        
    res.json({ users, page, pages: Math.ceil(count / pageSize) });
});


module.exports = {
    getAdminDashboard,
    getPayouts,
    approvePayout,
    rejectPayout,
    verifyPayoutStatus,
    getAllUsers,
    updateUserStatus,
    getCreatorDetails,
    getAllViewers,
    updateUserRole,
    getOnboarders,
    getOnboarderDetails,
};
