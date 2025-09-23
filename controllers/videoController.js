const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const User = require('../models/User');
const Transaction = require('../models/Transaction');
const { fetchVideoDetails } = require('../services/youtubeService');
const { getYouTubeVideoId } = require('../utils/videoUtils'); // We will create this utility

// @desc    Monetize a new YouTube video
// @route   POST /api/videos
// @access  Private (Creator)
const createVideo = asyncHandler(async (req, res) => {
    const { youtubeUrl, price } = req.body;
    const creatorId = req.user._id;

    // ADD THIS LINE FOR DEBUGGING:
    console.log('[DEBUG] Received youtubeUrl:', youtubeUrl);


    if (!youtubeUrl || !price) {
        res.status(400);
        throw new Error('Please provide a YouTube URL and a price.');
    }

    const youtubeVideoId = getYouTubeVideoId(youtubeUrl);
    if (!youtubeVideoId) {
        res.status(400);
        throw new Error('Invalid YouTube URL provided.');
    }

    const videoDetails = await fetchVideoDetails(youtubeVideoId);
    if (!videoDetails) {
        res.status(404);
        throw new Error('Video could not be found on YouTube.');
    }

    const { title, thumbnailUrl, description } = videoDetails;
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + `-${Date.now().toString().slice(-6)}`;
    const priceKobo = Math.round(price * 100);

    const video = await Video.create({
        creator: creatorId,
        youtubeVideoId,
        title,
        thumbnailUrl,
        description,
        priceKobo,
        shareableSlug: slug,
    });

    res.status(201).json(video);
});

// @desc    Get a single video by its slug for public viewing
// @route   GET /api/videos/:slug
// @access  Public
const getVideoBySlug = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug })
        .populate('creator', 'displayName avatarUrl'); // Populate creator info

    if (video) {
        res.json(video);
    } else {
        res.status(404);
        throw new Error('Video not found');
    }
});

const checkVideoAccess = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug });
    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }

    const transaction = await Transaction.findOne({
        viewer: req.user._id,
        video: video._id,
        status: 'successful'
    });

    if (transaction) {
        res.status(200).json({ hasAccess: true });
    } else {
        res.status(200).json({ hasAccess: false });
    }
});

module.exports = {
    createVideo,
    getVideoBySlug,
    checkVideoAccess, // Export the new function
};