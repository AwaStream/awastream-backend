const asyncHandler = require('express-async-handler');
const Transaction = require('../models/Transaction');
const Video = require('../models/Video');

// @desc    Get viewer's purchased videos and suggested content
// @route   GET /api/v1/viewer/library
// @access  Private (Viewer)
const getLibraryData = asyncHandler(async (req, res) => {
    // 1. Find all successful transactions for the logged-in user
    const successfulTransactions = await Transaction.find({
        user: req.user.id,
        status: 'successful',
    });

    // 2. Extract the video IDs from those transactions
    const purchasedVideoIds = successfulTransactions.map(t => t.video);

    // 3. Fetch the full video details for the purchased videos
    // We also populate the creator's information to display their name.
    const purchased = await Video.find({
        '_id': { $in: purchasedVideoIds }
    }).populate('creator', 'firstName lastName');

    // 4. Fetch some other videos to suggest (that the user hasn't bought)
    // Here we limit it to 10 recent videos as a simple suggestion algorithm.
    const suggested = await Video.find({
        '_id': { $nin: purchasedVideoIds } // The key is excluding what they already own
    }).populate('creator', 'firstName lastName').limit(10).sort({ createdAt: -1 });

    res.status(200).json({ purchased, suggested });
});

module.exports = {
    getLibraryData,
};