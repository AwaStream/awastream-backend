const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Bundle = require('../models/Bundle'); // Import the Bundle model
const { generateVideoAccessToken } = require('../utils/generateVideoAccessToken');

/**
 * @desc    Generate a short-lived access token for a video after verifying the user's rights.
 * @route   POST /api/access/generate-token
 * @access  Private
 */
const generateToken = asyncHandler(async (req, res) => {
    const { slug } = req.body;
    if (!slug) {
        res.status(400);
        throw new Error('Video slug is required.');
    }
    const video = await Video.findOne({ shareableSlug: slug });

    if (!video) {
        res.status(404);
        throw new Error('Video not found.');
    }

    const user = req.user;
    let hasAccess = false;

    // 1. Authorization Check #1: Is the user the creator of the video?
    if (video.creator.toString() === user._id.toString()) {
        hasAccess = true;
    }

    // 2. Authorization Check #2: If not the creator, has the user successfully purchased the video directly?
    if (!hasAccess) {
        const directTransaction = await Transaction.findOne({
            user: user._id, // Corrected field name
            product: video._id, // Corrected field name
            productType: 'Video', // Explicitly check for video transaction
            status: 'successful'
        });
        if (directTransaction) {
            hasAccess = true;
        }
    }

    // 3. Authorization Check #3: If not directly purchased, has the user purchased a bundle containing this video?
    if (!hasAccess) {
        // Find all successful bundle transactions for this user
        const bundleTransactions = await Transaction.find({
            user: user._id,
            status: 'successful',
            productType: 'Bundle'
        });

        if (bundleTransactions.length > 0) {
            const purchasedBundleIds = bundleTransactions.map(t => t.product);

            // Check if any of these purchased bundles contain the current video
            const containingBundle = await Bundle.findOne({
                _id: { $in: purchasedBundleIds },
                videos: video._id ,
                creator: video.creator// Check if the video is in the bundle's 'videos' array
            });

            if (containingBundle) {
                hasAccess = true;
            }
        }
    }

    // 4. If authorization fails after all checks, block access.
    if (!hasAccess) {
        res.status(403);
        throw new Error('Access denied. Please purchase this video or a bundle containing it to watch.');
    }

    // 5. Authorization successful! Prepare the response.
    const watermarkText = user.email;

    if (video.sourceType === 'youtube') {
        res.status(200).json({
            sourceType: 'youtube',
            sourceId: video.sourceId,
            watermarkText: watermarkText,
        });
    } else if (video.sourceType === 'direct') {
        const accessToken = generateVideoAccessToken(user, video);
        
        if (!process.env.BACKEND_URL) {
            throw new Error("Server configuration error.");
        }
        
        const streamUrl = `${process.env.BACKEND_URL}/api/v1/videos/stream/${video.shareableSlug}?token=${accessToken}`;
        
        res.status(200).json({
            sourceType: 'direct',
            streamUrl: streamUrl, 
            watermarkText: watermarkText,
        });
    } else {
        res.status(500);
        throw new Error('Invalid video source type found in the database.');
    }
});

/**
 * @desc    Check if a logged-in user has access to a given product (video or bundle).
 * @route   GET /api/v1/access/check/:productType/:slug
 * @access  Private
 */
const checkAccess = asyncHandler(async (req, res) => {
    const { productType, slug } = req.params;
    const user = req.user;

    let hasAccess = false;

    if (productType === 'video') {
        // 🚨 NOTE: Need to select 'creator' field for the security check later
        const video = await Video.findOne({ shareableSlug: slug });
        if (!video) {
            return res.status(200).json({ hasAccess: false });
        }

        // Check 1: Is user the creator?
        if (video.creator.toString() === user._id.toString()) {
            hasAccess = true;
        }

        // Check 1.5: Is the video free? (Good practice to add this early)
        if (video.priceKobo === 0) {
            hasAccess = true;
        }

        // Check 2: Did user buy the video directly?
        if (!hasAccess) {
            const directPurchase = await Transaction.findOne({ user: user._id, product: video._id, status: 'successful' });
            if (directPurchase) hasAccess = true;
        }

        // Check 3: Did user buy a bundle containing the video?
        if (!hasAccess) {
            const bundleTransactions = await Transaction.find({ user: user._id, productType: 'Bundle', status: 'successful' });
            if (bundleTransactions.length > 0) {
                const purchasedBundleIds = bundleTransactions.map(t => t.product);
                
                // 🚨 CRITICAL FIX: Add the creator match condition!
                const containingBundle = await Bundle.findOne({ 
                    _id: { $in: purchasedBundleIds }, 
                    videos: video._id,
                    creator: video.creator // <-- SECURITY FIX: Must be from the same creator
                });
                
                if (containingBundle) hasAccess = true;
            }
        }
    } else if (productType === 'bundle') {
        const bundle = await Bundle.findOne({ shareableSlug: slug });
        if (!bundle) {
            return res.status(200).json({ hasAccess: false });
        }

        // Check 1: Is user the creator?
        if (bundle.creator.toString() === user._id.toString()) {
            hasAccess = true;
        }

        // Check 2: Did user buy the bundle directly?
        if (!hasAccess) {
            const bundlePurchase = await Transaction.findOne({ user: user._id, product: bundle._id, status: 'successful' });
            if (bundlePurchase) hasAccess = true;
        }
    }

    res.status(200).json({ hasAccess });
});

module.exports = {
    generateToken,
    checkAccess,
};