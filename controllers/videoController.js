const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Comment = require('../models/Comment');
const WatchSession = require('../models/WatchSession');
const VideoViewAggregate = require('../models/VideoViewAggregate')
const { generateVideoAccessToken } = require('../utils/generateVideoAccessToken');
const { fetchVideoDetails, getYouTubeVideoId } = require('../services/youtubeService');
const { generatePresignedUploadUrl, getVideoStream } = require('../services/s3Service');
const { startOfDay, endOfDay, eachDayOfInterval, formatISO, format } = require('date-fns');

/**
 * @desc    Monetize a new video from either YouTube or a direct upload.
 * @route   POST /api/videos
 * @access  Private (Creator)
 */
const createVideo = asyncHandler(async (req, res) => {
    const {
        priceNaira,
        sourceType,
        youtubeUrl,
        title: directTitle,
        description: directDescription,
        thumbnailUrl: directThumbnailUrl,
        s3Key,
        trailerSourceType,
        trailerSourceId
    } = req.body;

    const creatorId = req.user.id;
    const priceValue = parseFloat(priceNaira);
    let videoDataForDb = {};

    // --- Validate input and gather data based on sourceType ---
    if (sourceType === 'youtube') {
        if (isNaN(priceValue) || (priceValue > 0 && priceValue < 150)) {
    res.status(400);
    throw new Error('Price for a YouTube video must be 0 (free) or at least 150 Naira.');
    }
        if (!youtubeUrl) {
            res.status(400);
            throw new Error('youtubeUrl is required for this source type.');
        }

        // Fetch details from the YouTube service
        const ytDetails = await fetchVideoDetails(youtubeUrl);
        const ytVideoId = getYouTubeVideoId(youtubeUrl);
        if (!ytDetails || !ytVideoId) {
            res.status(400);
            throw new Error('The provided YouTube URL is invalid or the video could not be found.');
        }

        videoDataForDb = {
            sourceType: 'youtube',
            sourceId: ytVideoId,
            title: ytDetails.title,
            description: ytDetails.description,
            thumbnailUrl: ytDetails.thumbnailUrl,
        };

    } else if (sourceType === 'direct') {
        // Conditional price validation for Direct Monetization
        if (isNaN(priceValue) || (priceValue > 0 && priceValue < 150)) {
    res.status(400);
    throw new Error('Price for a YouTube video must be 0 (free) or at least 150 Naira.');
}
        if (!directTitle || !s3Key || !directThumbnailUrl) {
            res.status(400);
            throw new Error('title, s3Key, and thumbnailUrl are required for this source type.');
        }

        videoDataForDb = {
            sourceType: 'direct',
            sourceId: s3Key, 
            title: directTitle,
            description: directDescription,
            thumbnailUrl: directThumbnailUrl,
        };

    } else {
        res.status(400);
        throw new Error('Invalid sourceType provided. Must be "youtube" or "direct".');
    }

    //Generate slug and save the video to our database
    const baseSlug = videoDataForDb.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const randomBytes = crypto.randomBytes(4).toString('hex');
    const shareableSlug = `${baseSlug}-${randomBytes}`;
    const priceKobo = Math.round(priceValue * 100);

    const newVideo = await Video.create({
        creator: creatorId,
        sourceType: videoDataForDb.sourceType,
        sourceId: videoDataForDb.sourceId,
        title: videoDataForDb.title,
        description: videoDataForDb.description,
        thumbnailUrl: videoDataForDb.thumbnailUrl,
        priceNaira: priceValue,
        priceKobo: Math.round(priceValue * 100),
        shareableSlug,
        trailerSourceType: trailerSourceType || 'none',
        trailerSourceId: trailerSourceId,
    });

    if (newVideo) {
        res.status(201).json(newVideo);
    } else {
        res.status(500);
        throw new Error('Failed to create the video in the database after validation.');
    }
});


/**
 * @desc    Update a monetized video
 * @route   PUT /api/videos/:slug
 * @access  Private (Creator)
 */
// @desc    Update video details (title, price, trailer)
// @route   PUT /api/videos/:slug
// @access  Private (Creator)
const updateVideo = asyncHandler(async (req, res) => {
    const { slug } = req.params;
    const { priceNaira, title, description, trailerSourceType, trailerSourceId } = req.body;
    
    // 1. Find Video and Authorize
    const video = await Video.findOne({ shareableSlug: slug });

    if (!video) {
        res.status(404);
        throw new Error('Video not found.');
    }
    
    // Authorization Check: Must be the creator to edit
    if (video.creator.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to update this video.');
    }

    // 2. Data Validation and Pre-processing
    let updates = { title, description };

    if (priceNaira !== undefined) {
        const priceValue = parseFloat(priceNaira);
        // (Add your full price validation here: e.g., allow 0, check minimums)
        updates.priceNaira = priceValue;
        updates.priceKobo = Math.round(priceValue * 100);
    }

    // 3. Trailer Logic (Handling a NEW upload or a URL change)
    if (trailerSourceType) {
        updates.trailerSourceType = trailerSourceType;
        
        if (trailerSourceType === 'youtube') {
            updates.trailerSourceId = trailerSourceId;
        } else if (trailerSourceType === 'direct') {
                 updates.trailerSourceId = trailerSourceId || video.trailerSourceId;
        } else {
            // If 'none' or null, clear the source ID
            updates.trailerSourceId = null;
        }
    }
    
    // 4. Execute Update
    const updatedVideo = await Video.findByIdAndUpdate(video._id, updates, {
        new: true, // Return the updated document
        runValidators: true,
    });

    res.status(200).json(updatedVideo);
});

/**
 * @desc    Generate a presigned URL for direct S3 upload by calling the S3 service.
 * @route   POST /api/videos/generate-upload-url
 * @access  Private (Creator)
 */
const generateUploadUrl = asyncHandler(async (req, res) => {
    const { filename, filetype } = req.body;
    if (!filename || !filetype) {
        res.status(400);
        throw new Error('Filename and filetype are required.');
    }
    const uploadData = await generatePresignedUploadUrl(req.user.id, filename, filetype);
    res.status(200).json(uploadData);
});

/**
 * @desc    Stream a directly monetized video from S3, secured by a short-lived token.
 * @route   GET /api/videos/stream/:slug
 * @access  Private (via token)
 */
const streamVideo = asyncHandler(async (req, res) => {
    const { token } = req.query;
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token.');
    }

    try {
        // Verify the short-lived token is valid and not expired
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Find the video and ensure the token matches the video being requested
        const video = await Video.findOne({ shareableSlug: req.params.slug });
        if (!video || video._id.toString() !== decoded.videoId) {
            res.status(401);
            throw new Error('Not authorized for this video.');
        }
        
        // Get the video stream from our S3 service
        const { stream, contentType, contentLength } = await getVideoStream(video.sourceId);

        // Set the response headers to tell the browser it's a video stream
        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': contentLength,
        });

        // Pipe the stream from S3 directly to the user's browser
        stream.pipe(res);
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, token is invalid or has expired.');
    }
});

/**
 * @desc    Get transaction history for a single video
 * @route   GET /api/videos/:id/transactions
 * @access  Private (Creator)
 */
const getVideoTransactions = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug});

    if (!video || video.creator.toString() !== req.user.id) {
        res.status(401);
        throw new Error('Not authorized for this video');
    }

    const transactions = await Transaction.find({ product: video._id, productType: 'Video', status: 'successful' })
        .sort({ createdAt: -1 });

    res.status(200).json(transactions);
});

/**
 * @desc    Get the playback details (token or ID) for a video after verifying purchase.
 * @route   GET /api/videos/access/:slug
 * @access  Private (Authenticated)
 */

const getPlaybackDetails = asyncHandler(async (req, res) => {
    // 1. Find the video FIRST.
    const video = await Video.findOne({ shareableSlug: req.params.slug });

    // 2. CRITICAL: Check if video exists *before* trying to read its properties.
    if (!video) {
        res.status(404);
        throw new Error('Video not found.');
    }

    // 3. Initialize the access flag
    let hasAccess = false;

    // 4. Run the access checks in order of priority (cheapest check first)
    
    // Check 1: Is the video free?
    if (video.priceKobo === 0) {
        hasAccess = true;
    }

    // Check 2: If not free, is the user the creator?
    if (!hasAccess && video.creator.toString() === req.user.id) {
        hasAccess = true;
    }

    // Check 3: If not free and not the creator, has the user paid?
    if (!hasAccess) {
        const transaction = await Transaction.findOne({
            user: req.user.id,
            product: video._id,
            productType: 'Video',
            status: 'successful',
        });
        
        if (transaction) {
            hasAccess = true;
        }
    }

    // 5. Final denial if no access was granted
    if (!hasAccess) {
        res.status(403); // 403 Forbidden
        throw new Error('Access denied. You must purchase this video to watch it.');
    }

    // 6. Access Granted: Return the correct key based on video type
    if (video.sourceType === 'direct') {
        const streamToken = generateVideoAccessToken(req.user, video);
        res.status(200).json({
            sourceType: 'direct',
            streamUrl: `/api/v1/videos/stream/${video.shareableSlug}?token=${streamToken}`,
        });
    } else if (video.sourceType === 'youtube') {
        res.status(200).json({
            sourceType: 'youtube',
            sourceId: video.sourceId,
        });
    }
});


/**
 * @desc    Stream a public trailer for a 'direct' video
 * @route   GET /api/videos/trailer/:slug
 * @access  Public
 */
const getTrailerStream = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug });

    if (!video || video.sourceType !== 'direct' || video.trailerSourceType !== 'direct' || !video.trailerSourceId) {
        res.status(404);
        throw new Error('Trailer not found.');
    }

    try {
        // We use the same S3 service, just with the trailer's S3 key
        const { stream, contentType, contentLength } = await getVideoStream(video.trailerSourceId);

        res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Length': contentLength,
            'Accept-Ranges': 'bytes', // Good for video players
        });

        stream.pipe(res);
    } catch (error) {
        res.status(404);
        throw new Error('Trailer file not found or is corrupt.');
    }
});

const getVideoBySlug = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug })
        .populate('creator', 'userName avatarUrl');

    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }
    
    // --- CORRECTED PUBLIC DATA RESPONSE ---
    const publicVideoData = {
        _id: video._id,
        title: video.title,
        description: video.description,
        thumbnailUrl: video.thumbnailUrl,
        priceNaira: video.priceNaira,
        priceKobo: video.priceKobo,
        shareableSlug: video.shareableSlug,
        creator: video.creator,
        sourceType: video.sourceType,
        trailerSourceType: video.trailerSourceType || 'none', 
        trailerSourceId: video.trailerSourceId || null,
    };

    return res.json(publicVideoData);
});

const getDailyPerformance = asyncHandler(async (req, res) => {
    try {

        const video = await Video.findOne({ shareableSlug: req.params.slug });

        if (!video) {
            return res.status(404).json({ message: 'Video not found' });
        }

        if (video.creator.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to update this video.');
    }


        const videoId = video._id;
        const endDate = endOfDay(new Date());
        const startDate = startOfDay(new Date(endDate.getTime() - 29 * 24 * 60 * 60 * 1000));

        const salesData = await Transaction.aggregate([
            { $match: { product: videoId, productType: 'Video', status: 'successful', createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                sales: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]);
        
           // --- NEW (Uses the correct VideoViewAggregate model for analytics) ---
const viewsData = await VideoViewAggregate.aggregate([
    { $match: { 
        video: videoId, 
        viewCounted: true, // Only count if the 30-second rule was met
        viewCountedAt: { $gte: startDate, $lte: endDate } 
    } },
    { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        views: { $sum: 1 } // Summing the *counted* views
    }},
    { $sort: { _id: 1 } }
]);
        const allDays = eachDayOfInterval({ start: startDate, end: endDate });
        const performanceMap = new Map();
        
        allDays.forEach(day => {
            const formattedDate = formatISO(day, { representation: 'date' });
            performanceMap.set(formattedDate, { date: format(day, 'MMM d'), sales: 0, views: 0 });
        });

        salesData.forEach(item => {
            if (performanceMap.has(item._id)) {
                performanceMap.get(item._id).sales = item.sales;
            }
        });

        viewsData.forEach(item => {
            if (performanceMap.has(item._id)) {
                performanceMap.get(item._id).views = item.views;
            }
        });

        const finalResponseData = Array.from(performanceMap.values());
        
        res.status(200).json(finalResponseData);

    } catch (error) {
        res.status(500).json({ message: "An internal server error occurred.", error: error.message });
    }
});

// @desc    Get private details and stats for a single creator video
// @route   GET /api/videos/:id/stats
// @access  Private (Creator)
const getVideoStats = asyncHandler(async (req, res) => {
    const video = await Video.findOne({ shareableSlug: req.params.slug });

if (!video || video.creator.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized for this video');
}
    const videoId = video._id;

   const earningsAggregation = await Transaction.aggregate([
        { $match: { product: video._id, productType: 'Video', status: 'successful' } },
        { $group: { 
            _id: null, 
            totalEarnings: { $sum: '$creatorEarningsKobo' }
        }}
    ]);

    const conversionRate = video.totalViews > 0 ? ((video.totalSales / video.totalViews) * 100).toFixed(1) : 0;

    const stats = {
        totalEarningsKobo: earningsAggregation.length > 0 ? earningsAggregation[0].totalEarnings : 0,
        totalSales: video.totalSales,       // Use the fast counter
        pageViews: video.totalViews,        // Use the fast counter
        conversionRate: parseFloat(conversionRate),
    };

    res.status(200).json({ video, stats });
});

// @desc      Delete a monetized video and its associated data
// @route     DELETE /api/videos/:slug
// @access    Private (Creator)
const deleteVideo = asyncHandler(async (req, res) => {

    const video = await Video.findOne({ shareableSlug: req.params.slug });

    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }

    if (video.creator.toString() !== req.user._id.toString()) {
        res.status(401);
        throw new Error('Not authorized to update this video.');
    }

    await Bundle.updateMany(
        { videos: video._id }, 
        { $pull: { videos: video._id } }
    );

    // Delete associated data
await Comment.deleteMany({ video: video._id });
await VideoViewAggregate.deleteMany({ video: video._id });
await WatchSession.deleteMany({ video: video._id }); 

await video.deleteOne();

    res.status(200).json({ message: 'Video removed successfully' });
});


/**
 * @desc    Get all videos for the logged-in creator
 * @route   GET /api/videos
 * @access  Private (Creator)
 */
const getAllCreatorVideos = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    const videos = await Video.find({ creator: creatorId }).sort({ createdAt: -1 });

    if (videos) {
        res.status(200).json(videos);
    } else {
        res.status(404);
        throw new Error('No videos found for this creator.');
    }
});

module.exports = {
    createVideo,
    updateVideo,
    getVideoBySlug,
    generateUploadUrl,
    getAllCreatorVideos,
    streamVideo,
    deleteVideo,
    getVideoStats,
    getVideoTransactions,
    getDailyPerformance,
    getPlaybackDetails,
    getTrailerStream,

};