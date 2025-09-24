const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction'); // Make sure the path is correct
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

    // The currently logged-in user is available from our `authenticate` middleware.
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

    // 3. If authorization fails, block access with a "Forbidden" status.
    if (!hasAccess) {
        res.status(403); 
        throw new Error('Access denied. Please purchase this video to watch.');
    }

    // 4. Authorization successful! Prepare the response for the frontend.
    const watermarkText = user.email; // You can use user.userName or user._id as well.

    if (video.sourceType === 'youtube') {
        // For YouTube videos, we just need to send the Video ID.
        res.status(200).json({
            sourceType: 'youtube',
            sourceId: video.sourceId,
            watermarkText: watermarkText,
        });
    } else if (video.sourceType === 'direct') {
        // For Direct Monetization, we generate the short-lived token.
        const accessToken = generateVideoAccessToken(user, video);
        
        // Then we construct the full, temporary stream URL for the frontend player.
        const streamUrl = `/api/videos/stream/${video.shareableSlug}?token=${accessToken}`;
        
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