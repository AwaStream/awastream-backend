// const express = require('express');
// const router = express.Router();
// const {
//     createVideo,
//     getVideoBySlug,
//     generateUploadUrl,
//     streamVideo,
//     deleteVideo,
//     getAllCreatorVideos,
//     getVideoStats,
//     getVideoTransactions
// } = require('../controllers/videoController');

// const { authenticate } = require('../middleware/authMiddleware');

// // @desc    Get all videos for the logged-in creator
// // @route   GET /api/v1/videos
// // @access  Private
// router.route('/').get(authenticate, getAllCreatorVideos);

// // @desc    Monetize a new video
// // @route   POST /api/v1/videos
// // @access  Private
// router.route('/').post(authenticate, createVideo);

// // @desc    Get a presigned URL for a direct S3 upload
// // @route   POST /api/v1/videos/generate-upload-url
// // @access  Private
// router.route('/generate-upload-url').post(authenticate, generateUploadUrl);

// router.route('/:id/transactions').get(authenticate, getVideoTransactions);

// router.route('/:id/stats').get(authenticate, getVideoStats);

// // @desc    Stream a directly monetized video from S3
// // @route   GET /api/v1/videos/stream/:slug
// // @access  Private (via short-lived token)
// router.route('/stream/:slug').get(streamVideo);

// // @desc    Get the public details of a video for a sales page
// // @route   GET /api/v1/videos/:slug
// // @access  Public
// router.route('/:slug').get(getVideoBySlug);

// // @desc    Delete a monetized video
// // @route   DELETE /api/v1/videos/:id
// // @access  Private
// router.route('/:id').delete(authenticate, deleteVideo);


// module.exports = router;




// routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const {
    createVideo,
    getVideoBySlug,
    generateUploadUrl,
    streamVideo,
    deleteVideo,
    getAllCreatorVideos,
    getVideoStats,
    getDailyPerformance,
    getVideoTransactions, 
} = require('../controllers/videoController');
const { authenticate } = require('../middleware/authMiddleware');

// --- Main creator routes for their own videos ---
router.route('/')
    .get(authenticate, getAllCreatorVideos)
    .post(authenticate, createVideo);

// --- Specific action routes ---
router.post('/generate-upload-url', authenticate, generateUploadUrl);
router.get('/stream/:slug', streamVideo);

// --- 
// FIX: All slug-based routes now correctly use '/:slug/...'
// and are placed BEFORE the generic '/:slug' route to avoid conflicts.
// ---
router.get('/:slug/stats', authenticate, getVideoStats);
router.get('/:slug/transactions', authenticate, getVideoTransactions);
router.get('/:slug/daily-performance', authenticate, getDailyPerformance); // This was the broken route

// --- Generic public and protected routes ---
router.route('/:id')
    .delete(authenticate, deleteVideo); // Standardized to use slug

module.exports = router;