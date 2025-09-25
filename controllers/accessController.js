const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
// --- FIX: Corrected the import path to match the filename we created ---
const { generateVideoAccessToken } = require('../utils/generateVideoAccessToken');

/**
 * @desc    Generate a short-lived access token for a video after verifying the user's rights.
 * @route   POST /api/access/generate-token
 * @access  Private
 */
const generateToken = asyncHandler(async (req, res) => {
    // 1. Find the video the user wants to watch from the request body.
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

    // 2. Authorization Check: Does this user have the right to watch?
    let hasAccess = false;

    // Check #1: Is the user the creator of the video?
    if (video.creator.toString() === user._id.toString()) {
        hasAccess = true;
    }

    // Check #2: If not the creator, has the user successfully purchased the video?
    if (!hasAccess) {
        const transaction = await Transaction.findOne({
            viewer: user._id,
            video: video._id,
            status: 'successful'
        });
        if (transaction) {
            hasAccess = true;
        }
    }

    // 3. If authorization fails, block access.
    if (!hasAccess) {
        res.status(403); 
        throw new Error('Access denied. Please purchase this video to watch.');
    }

    // 4. Authorization successful! Prepare the response.
    const watermarkText = user.email;

    if (video.sourceType === 'youtube') {
        res.status(200).json({
            sourceType: 'youtube',
            sourceId: video.sourceId,
            watermarkText: watermarkText,
        });
    } else if (video.sourceType === 'direct') {
        const accessToken = generateVideoAccessToken(user, video);
        
        // --- FIX: Construct a full, absolute URL for the stream ---
        if (!process.env.BACKEND_URL) {
            console.error("CRITICAL: BACKEND_URL is not set in your .env file.");
            throw new Error("Server configuration error.");
        }
        
        const streamUrl = `${process.env.BACKEND_URL}/api/v1/videos/stream/${video.shareableSlug}?token=${accessToken}`;
        
        res.status(200).json({
            sourceType: 'direct',
            streamUrl: streamUrl, // Send the full URL to the frontend
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