const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const { fetchVideoDetails, getYouTubeVideoId } = require('../services/youtubeService');


/**
 * @desc    Monetize a new video
 * @route   POST /api/v1/videos
 * @access  Private (Creator)
 */

const createVideo = asyncHandler(async (req, res) => {
    const { youtubeUrl, priceNaira } = req.body;
    const creatorId = req.user.id;

    if (!youtubeUrl || priceNaira === undefined) {
        res.status(400);
        throw new Error('Please provide a YouTube URL and a price.');
    }
    
    const priceValue = parseFloat(priceNaira);

    if (isNaN(priceValue) || priceValue < 150) {
        res.status(400);
        throw new Error('Price must be at least 150 Naira.');
    }

    const videoDetails = await fetchVideoDetails(youtubeUrl);
    const youtubeVideoId = getYouTubeVideoId(youtubeUrl);

    if (!videoDetails || !youtubeVideoId) {
        res.status(400);
        throw new Error('The provided YouTube URL is invalid or the video could not be found.');
    }

    const { title, thumbnailUrl, description } = videoDetails;

    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const randomBytes = crypto.randomBytes(4).toString('hex');
    const shareableSlug = `${baseSlug}-${randomBytes}`;

    const priceKobo = Math.round(priceValue * 100);

    const videoObjectToSave = {
        creator: creatorId,
        youtubeUrl: youtubeUrl,
        youtubeVideoId,
        title,
        thumbnailUrl,
        description,
        priceNaira: priceValue,
        priceKobo,
        shareableSlug,
    };
    
    const newVideo = await Video.create(videoObjectToSave);

    if (newVideo) {
        res.status(201).json(newVideo);
    } else {
        res.status(500); 
        throw new Error('Failed to create the video in the database after validation.');
    }
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