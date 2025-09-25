const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const User = require('../models/User');
const payoutService = require('../services/payoutService'); // Import the service

// @desc    Get statistics for the logged-in creator's dashboard
// @route   GET /api/v1/creator/dashboard
// @access  Private (Creator)
const getCreatorDashboard = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    // Calculate revenue from the creator's actual net earnings
    const revenueAggregation = await Transaction.aggregate([
        { $match: { creator: creatorId, status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
    ]);
    const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;

    // Subtract all non-failed/rejected payouts to get an accurate available balance
    const payoutAggregation = await Payout.aggregate([
        { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;

    const totalSales = await Transaction.countDocuments({ creator: creatorId, status: 'successful' });
    const monetizedVideosCount = await Video.countDocuments({ creator: creatorId });
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
    const creator = await User.findById(req.user.id).select('userName email firstName lastName avatarUrl payoutBankName payoutAccountNumber payoutAccountName');
    
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
    const { 
        payoutBankName,
        payoutAccountNumber,
        payoutAccountName,
        firstName,
        lastName,
        userName
    } = req.body;

    const fieldsToUpdate = {};
    // Only add fields to the update object if they were provided in the request
    if (payoutBankName !== undefined) fieldsToUpdate.payoutBankName = payoutBankName;
    if (payoutAccountNumber !== undefined) fieldsToUpdate.payoutAccountNumber = payoutAccountNumber;
    if (payoutAccountName !== undefined) fieldsToUpdate.payoutAccountName = payoutAccountName;
    if (firstName) fieldsToUpdate.firstName = firstName;
    if (lastName) fieldsToUpdate.lastName = lastName;
    if (userName) fieldsToUpdate.userName = userName;

    const updatedCreator = await User.findByIdAndUpdate(
        req.user.id,
        { $set: fieldsToUpdate },
        { new: true, runValidators: true }
    ).select('-passwordHash');

    if (updatedCreator) {
        res.json(updatedCreator);
    } else {
        res.status(404);
        throw new Error('Creator not found');
    }
});

// @desc    Get the logged-in creator's payout history
// @route   GET /api/v1/creator/payouts
// @access  Private (Creator)
const getCreatorPayouts = asyncHandler(async (req, res) => {
    const payouts = await Payout.find({ creator: req.user.id }).sort({ createdAt: -1 });

    res.status(200).json(payouts);
});

// Add this new function inside controllers/creatorController.js
const getCreatorTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ creator: req.user.id, status: 'successful' })
        .populate('video', 'title') // Get the video title
        .sort({ createdAt: -1 });

    res.status(200).json(transactions);
});


// @desc    Create a new payout request
// @route   POST /api/v1/creator/payouts
// @access  Private (Creator)
const requestPayout = asyncHandler(async (req, res) => {
    const { amountKobo } = req.body;
    const creatorId = new mongoose.Types.ObjectId(req.user.id);
    const payoutMode = process.env.PAYOUT_MODE || 'manual';

    if (!amountKobo || amountKobo <= 0) {
        res.status(400);
        throw new Error('A valid payout amount is required.');
    }

    // --- Balance Calculation ---
    const payoutAggregation = await Payout.aggregate([
        { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    const revenueAggregation = await Transaction.aggregate([
        { $match: { creator: creatorId, status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
    ]);
    const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
    const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
    const availableBalanceKobo = totalRevenueKobo - totalPayoutsKobo;

    if (amountKobo > availableBalanceKobo) {
        res.status(400);
        throw new Error('Payout request exceeds your available balance.');
    }

    if (payoutMode === 'automatic') {
        // --- AUTOMATIC FLOW ---
        let creator = await User.findById(creatorId);
        if (!creator || !creator.payoutBankName || !creator.payoutAccountNumber || !creator.payoutAccountName) {
            res.status(400);
            throw new Error('Please complete your bank details in your profile before requesting a payout.');
        }

        if (!creator.paystackRecipientCode) {
            console.log(`No recipient code found for creator ${creatorId}. Creating one.`);
            await payoutService.verifyBankAccount(creator.payoutAccountNumber, creator.payoutBankName);
            const recipientCode = await payoutService.createTransferRecipient(creator);
            
            creator.paystackRecipientCode = recipientCode;
            creator = await creator.save();
        }

        const payout = await Payout.create({
            creator: creatorId,
            amountKobo,
            status: 'processing',
        });
        
        try {
            const transferResult = await payoutService.initiateTransfer(
                amountKobo,
                creator.paystackRecipientCode,
                payout._id.toString()
            );

            payout.providerRef = transferResult.transfer_code;
            await payout.save();

            res.status(201).json(payout);

        } catch (error) {
            payout.status = 'failed';
            payout.notes = error.message;
            await payout.save();
            res.status(400).json({ message: error.message });
        }
    } else {
        // --- MANUAL FLOW ---
        const payout = await Payout.create({
            creator: creatorId,
            amountKobo,
            status: 'pending',
        });
        res.status(201).json(payout);
    }
});

module.exports = {
    getCreatorDashboard,
    getCreatorProfile,
    updateCreatorProfile,
    requestPayout,
    getCreatorPayouts,
    getCreatorTransactions,
};
