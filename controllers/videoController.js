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
        .select('-creator.passwordHash')
        .populate('creator', 'userName avatarUrl'); // Populate creator info

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

      if (video.creator.toString() === req.user.id.toString()) {
        return res.json({ hasAccess: true, youtubeUrl: video.youtubeUrl });
    }

    const transaction = await Transaction.findOne({
        viewer: req.user._id,
        video: video._id,
        status: 'successful'
    });

       if (transaction) {
        res.json({ hasAccess: true, youtubeUrl: video.youtubeUrl });
    } else {
        res.json({ hasAccess: false });
    }
});

module.exports = {
    createVideo,
    getVideoBySlug,
    checkVideoAccess, // Export the new function
};


















// const asyncHandler = require('express-async-handler');
// const crypto = require('crypto');
// const fs = require('fs');
// const path = require('path');
// const ytdl = require('ytdl-core');
// const ffmpeg = require('fluent-ffmpeg');

// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');

// const createVideo = asyncHandler(async (req, res) => {
//     const { youtubeUrl, priceNaira } = req.body;
//     const creatorId = req.user.id;
    
//     if (!youtubeUrl || parseFloat(priceNaira) < 150) {
//         res.status(400);
//         throw new Error('A valid YouTube URL and a price of at least 150 Naira are required.');
//     }
//     if (!ytdl.validateURL(youtubeUrl)) {
//         res.status(400);
//         throw new Error('The provided URL is not a valid YouTube URL.');
//     }

//     const videoId = ytdl.getURLVideoID(youtubeUrl);
//     const videoInfo = await ytdl.getInfo(youtubeUrl);
//     const { title, description, thumbnails } = videoInfo.videoDetails;
//     const thumbnailUrl = thumbnails[thumbnails.length - 1].url;

//     const outputDir = path.join(__dirname, '..', 'uploads', videoId);
//     const tempVideoPath = path.join(outputDir, 'temp_video.mp4');
//     const hlsManifestPath = path.join(outputDir, 'master.m3u8');
//     const keyPath = path.join(outputDir, 'aes.key');
//     const keyInfoPath = path.join(outputDir, 'key_info.txt');

//     if (!fs.existsSync(outputDir)) {
//         fs.mkdirSync(outputDir, { recursive: true });
//     }

//     try {
//         await new Promise((resolve, reject) => {
//             ytdl(youtubeUrl, { quality: 'highest' })
//                 .pipe(fs.createWriteStream(tempVideoPath))
//                 .on('finish', resolve)
//                 .on('error', reject);
//         });

//         const encryptionKey = crypto.randomBytes(16);
//         fs.writeFileSync(keyPath, encryptionKey);
        
//         const keyUrl = `/api/v1/videos/key/${videoId}`;
//         const keyInfoContent = `${keyUrl}\n${keyPath}`;
//         fs.writeFileSync(keyInfoPath, keyInfoContent);

//         await new Promise((resolve, reject) => {
//             ffmpeg(tempVideoPath)
//                 .outputOptions(['-hls_time 10', '-hls_list_size 0', '-hls_key_info_file', keyInfoPath])
//                 .output(hlsManifestPath)
//                 .on('end', resolve)
//                 .on('error', reject)
//                 .run();
//         });

//         const priceValue = parseFloat(priceNaira);
//         const priceKobo = Math.round(priceValue * 100);
//         const shareableSlug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${crypto.randomBytes(4).toString('hex')}`;
        
//         const newVideo = await Video.create({
//             creator: creatorId,
//             youtubeUrl,
//             youtubeVideoId: videoId,
//             title,
//             description,
//             thumbnailUrl,
//             priceNaira: priceValue,
//             priceKobo,
//             shareableSlug,
//             hlsManifestPath: `/uploads/${videoId}/master.m3u8`,
//             hlsEncryptionKey: encryptionKey,
//         });
        
//         res.status(201).json(newVideo);
//     } finally {
//         if (fs.existsSync(tempVideoPath)) fs.unlinkSync(tempVideoPath);
//         if (fs.existsSync(keyInfoPath)) fs.unlinkSync(keyInfoPath);
//     }
// });

// const getVideoBySlug = asyncHandler(async (req, res) => {
//     const video = await Video.findOne({ shareableSlug: req.params.slug })
//         .select('title description thumbnailUrl priceKobo shareableSlug')
//         .populate('creator', 'userName avatarUrl');
    
//     if (video) res.json(video);
//     else {
//         res.status(404);
//         throw new Error('Video not found');
//     }
// });

// const checkVideoAccess = asyncHandler(async (req, res) => {
//     const video = await Video.findOne({ shareableSlug: req.params.slug });
//     if (!video) {
//         res.status(404);
//         throw new Error('Video not found');
//     }

//     if (video.creator.toString() === req.user.id.toString()) {
//         return res.json({ hasAccess: true, manifestUrl: video.hlsManifestPath });
//     }

//     const transaction = await Transaction.findOne({ viewer: req.user.id, video: video._id, status: 'successful' });

//     if (transaction) {
//         res.json({ hasAccess: true, manifestUrl: video.hlsManifestPath });
//     } else {
//         res.json({ hasAccess: false });
//     }
// });

// const getHlsKey = asyncHandler(async (req, res) => {
//     const video = await Video.findOne({ youtubeVideoId: req.params.videoId }).select('+hlsEncryptionKey');
//     if (!video) {
//         return res.status(404).send("Key not found.");
//     }
    
//     const transaction = await Transaction.findOne({ viewer: req.user.id, video: video._id, status: 'successful' });
//     const isCreator = video.creator.toString() === req.user.id.toString();

//     if (!transaction && !isCreator) {
//         return res.status(403).send("Access denied.");
//     }
    
//     const keyPath = path.join(__dirname, '..', 'uploads', req.params.videoId, 'aes.key');
//     if (fs.existsSync(keyPath)) {
//         res.sendFile(keyPath);
//     } else {
//         res.status(404).send("Key file missing.");
//     }
// });

// module.exports = { createVideo, getVideoBySlug, checkVideoAccess, getHlsKey };