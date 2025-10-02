// const asyncHandler = require('express-async-handler');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const { generateVideoAccessToken } = require('../utils/generateVideoAccessToken');

// /**
//  * @desc    Generate a short-lived access token for a video after verifying the user's rights.
//  * @route   POST /api/access/generate-token
//  * @access  Private
//  */
// const generateToken = asyncHandler(async (req, res) => {
//     // 1. Find the video the user wants to watch from the request body.
//     const { slug } = req.body;
//     if (!slug) {
//         res.status(400);
//         throw new Error('Video slug is required.');
//     }
//     const video = await Video.findOne({ shareableSlug: slug });

//     if (!video) {
//         res.status(404);
//         throw new Error('Video not found.');
//     }

//     const user = req.user;

//     // 2. Authorization Check: Does this user have the right to watch?
//     let hasAccess = false;

//     // Check #1: Is the user the creator of the video?
//     if (video.creator.toString() === user._id.toString()) {
//         hasAccess = true;
//     }

//     // Check #2: If not the creator, has the user successfully purchased the video?
//     if (!hasAccess) {
//         const transaction = await Transaction.findOne({
//             user: user._id,
//             product: video._id,
//             status: 'successful'
//         });
//         if (transaction) {
//             hasAccess = true;
//         }
//     }

//     // 3. If authorization fails, block access.
//     if (!hasAccess) {
//         res.status(403); 
//         throw new Error('Access denied. Please purchase this video to watch.');
//     }

//     // 4. Authorization successful! Prepare the response.
//     const watermarkText = user.email;

//     if (video.sourceType === 'youtube') {
//         res.status(200).json({
//             sourceType: 'youtube',
//             sourceId: video.sourceId,
//             watermarkText: watermarkText,
//         });
//     } else if (video.sourceType === 'direct') {
//         const accessToken = generateVideoAccessToken(user, video);
        
//         if (!process.env.BACKEND_URL) {
//             throw new Error("Server configuration error.");
//         }
        
//         const streamUrl = `${process.env.BACKEND_URL}/api/v1/videos/stream/${video.shareableSlug}?token=${accessToken}`;
        
//         res.status(200).json({
//             sourceType: 'direct',
//             streamUrl: streamUrl, 
//             watermarkText: watermarkText,
//         });
//     } else {
//         res.status(500);
//         throw new Error('Invalid video source type found in the database.');
//     }
// });

// module.exports = {
//     generateToken,
// };







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
                videos: video._id // Check if the video is in the bundle's 'videos' array
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

module.exports = {
    generateToken,
};