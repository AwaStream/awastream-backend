const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Bundle = require('../models/Bundle');
const Video = require('../models/Video'); // To validate video IDs

/**
 * @desc    Create a new video bundle.
 * @route   POST /api/bundles
 * @access  Private (Creator)
 */
const createBundle = asyncHandler(async (req, res) => {
    const { title, description, thumbnailUrl, priceNaira, videoIds: rawVideoIds } = req.body;
    const creatorId = req.user.id;

    if (!title || !thumbnailUrl || !priceNaira) {
        res.status(400);
        throw new Error('Title, thumbnail URL, and price are required for a bundle.');
    }
    const videoIds = (Array.isArray(rawVideoIds) && rawVideoIds.length > 0) ? rawVideoIds : []; 

    const priceValue = parseFloat(priceNaira);
    if (isNaN(priceValue) || priceValue < 100) { // Minimum bundle price
        res.status(400);
        throw new Error('Bundle price must be a valid number and at least 100 Naira.');
    }

    // Validate if all provided videoIds exist and belong to the creator (optional but recommended for security)
    const existingVideos = await Video.find({
        _id: { $in: videoIds },
        creator: creatorId // Ensure creator owns these videos
    });

    if (existingVideos.length !== videoIds.length) {
        res.status(400);
        throw new Error('One or more video IDs are invalid or do not belong to you.');
    }

    const baseSlug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const randomBytes = crypto.randomBytes(4).toString('hex');
    const shareableSlug = `${baseSlug}-${randomBytes}`;
    const priceKobo = Math.round(priceValue * 100);

    const newBundle = await Bundle.create({
        creator: creatorId,
        title,
        description,
        thumbnailUrl,
        priceNaira: priceValue,
        priceKobo,
        shareableSlug,
        videos: videoIds, // Store the validated video IDs
    });

    if (newBundle) {
        res.status(201).json(newBundle);
    } else {
        res.status(500);
        throw new Error('Failed to create the bundle in the database.');
    }
});


/**
 * @desc    Update a bundle
 * @route   PUT /api/bundles/:slug
 * @access  Private (Creator)
 */
const updateBundle = asyncHandler(async (req, res) => {
    const { title, description, priceNaira } = req.body;
    
    const bundle = await Bundle.findOne({ shareableSlug: req.params.slug });

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found');
    }
    
    if (bundle.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized to update this bundle');
    }

    bundle.title = title || bundle.title;
    bundle.description = description !== undefined ? description : bundle.description;

    if (priceNaira) {
        const priceValue = parseFloat(priceNaira);
        if (isNaN(priceValue) || priceValue <= 0) {
            res.status(400);
            throw new Error('Please provide a valid price.');
        }
        bundle.priceNaira = priceValue;
        bundle.priceKobo = Math.round(priceValue * 100);
    }
    
    const updatedBundle = await bundle.save();
    res.status(200).json(updatedBundle);
});


/**
 * @desc    Get a single bundle by its slug
 * @route   GET /api/bundles/:slug
 * @access  Public
 */
const getBundleBySlug = asyncHandler(async (req, res) => {
    const bundle = await Bundle.findOne({ shareableSlug: req.params.slug })
        .populate('creator', 'userName avatarUrl')
        .populate('videos', 'title thumbnailUrl shareableSlug sourceType priceNaira creator'); // Populate videos for display

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found.');
    }

    // Sanitize the bundle response - exclude sourceId from individual videos in the bundle
    const sanitizedVideos = bundle.videos.map(video => ({
        _id: video._id,
        title: video.title,
        thumbnailUrl: video.thumbnailUrl,
        shareableSlug: video.shareableSlug,
        sourceType: video.sourceType,
        priceNaira: video.priceNaira,
        creator: video.creator,
    }));

    const publicBundleData = {
        _id: bundle._id,
        title: bundle.title,
        description: bundle.description,
        thumbnailUrl: bundle.thumbnailUrl,
        priceNaira: bundle.priceNaira,
        priceKobo: bundle.priceKobo,
        shareableSlug: bundle.shareableSlug,
        creator: bundle.creator,
        videos: sanitizedVideos, 
        totalSales: bundle.totalSales,
    };

    res.status(200).json(publicBundleData);
});

/**
 * @desc    Get all bundles for the logged-in creator
 * @route   GET /api/bundles
 * @access  Private (Creator)
 */
const getAllCreatorBundles = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);
    const bundles = await Bundle.find({ creator: creatorId }).sort({ createdAt: -1 });

    if (bundles) {
        res.status(200).json(bundles);
    } else {
        res.status(404);
        throw new Error('No bundles found for this creator.');
    }
});

/**
 * @desc    Delete a bundle and its associated data
 * @route   DELETE /api/bundles/:slug
 * @access  Private (Creator)
 */
const deleteBundle = asyncHandler(async (req, res) => {
    const bundle = await Bundle.findOne({ shareableSlug: req.params.slug });

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found');
    }

    if (bundle.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('User not authorized to delete this bundle');
    }

    // You might want to remove transactions associated with this bundle if they were pending/failed
    // For simplicity, we'll just delete the bundle itself here.
    // await Transaction.deleteMany({ product: bundle._id, productType: 'Bundle' });

    await bundle.deleteOne();

    res.status(200).json({ message: 'Bundle removed successfully' });
});


/**
 * @desc    Update the order of videos within a bundle.
 * @route   PUT /api/bundles/:bundleSlug/videos/reorder
 * @access  Private (Creator)
 */
const reorderBundleVideos = asyncHandler(async (req, res) => {
    const bundle = await Bundle.findOne({ shareableSlug: req.params.bundleSlug });

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found');
    }
    if (bundle.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('Not authorized to edit this bundle');
    }

    const { videoIds } = req.body;
    if (!Array.isArray(videoIds)) {
        res.status(400);
        throw new Error('videoIds must be an array.');
    }

    bundle.videos = videoIds; // Directly set the new order
    await bundle.save();

    res.status(200).json(bundle);
});

/**
 * @desc    Add a single video to a bundle.
 * @route   POST /api/bundles/:bundleSlug/videos/:videoId
 * @access  Private (Creator)
 */
const addVideoToBundle = asyncHandler(async (req, res) => {
    const bundle = await Bundle.findOne({ shareableSlug: req.params.bundleSlug });

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found');
    }
    if (bundle.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('Not authorized to edit this bundle');
    }

    const video = await Video.findById(req.params.videoId);
    if (!video || video.creator.toString() !== req.user.id) {
        res.status(404);
        throw new Error('Video not found or you do not own it.');
    }

    // Check if the video is already in the bundle
    if (bundle.videos.includes(video._id)) {
        res.status(400);
        throw new Error('This video is already in the bundle.');
    }

    bundle.videos.push(video._id);
    await bundle.save();

    res.status(200).json(bundle);
});

/**
 * @desc    Remove a single video from a bundle.
 * @route   DELETE /api/bundles/:bundleSlug/videos/:videoId
 * @access  Private (Creator)
 */
const removeVideoFromBundle = asyncHandler(async (req, res) => {
    const bundle = await Bundle.findOne({ shareableSlug: req.params.bundleSlug });

    if (!bundle) {
        res.status(404);
        throw new Error('Bundle not found');
    }
    if (bundle.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('Not authorized to edit this bundle');
    }

    // Pull the videoId from the videos array
    bundle.videos.pull(req.params.videoId);
    await bundle.save();

    res.status(200).json({ message: 'Video removed from bundle successfully.' });
});


module.exports = {
    createBundle,
    updateBundle,
    getBundleBySlug,
    getAllCreatorBundles,
    deleteBundle,
    removeVideoFromBundle,
    addVideoToBundle,
    reorderBundleVideos,
};