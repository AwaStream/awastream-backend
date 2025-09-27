// const express = require('express');
// const router = express.Router();
// const {
//     createVideo,
//     getVideoBySlug,
//     generateUploadUrl,
//     streamVideo,
//     deleteVideo,
//     getAllCreatorVideos,
// } = require('../controllers/videoController');

// const { authenticate } = require('../middleware/authMiddleware');

// // @desc    Monetize a new video (handles both youtube and direct)
// // @route   POST /api/v1/videos
// // @access  Private
// router.route('/').post(authenticate, createVideo);

// // @desc    Get a presigned URL for a direct S3 upload
// // @route   POST /api/v1/videos/generate-upload-url
// // @access  Private
// router.route('/generate-upload-url').post(authenticate, generateUploadUrl);

// // @desc    Stream a directly monetized video from S3
// // @route   GET /api/v1/videos/stream/:slug
// // @access  Private (via short-lived token)
// router.route('/stream/:slug').get(streamVideo);

// // @desc    Get the public details of a video for a sales page
// // @route   GET /api/v1/videos/:slug
// // @access  Public
// router.route('/:slug').get(getVideoBySlug);

// router.route('/').get(getAllCreatorVideos);

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
} = require('../controllers/videoController');

const { authenticate } = require('../middleware/authMiddleware');

// @desc    Get all videos for the logged-in creator
// @route   GET /api/v1/videos
// @access  Private
// FIX 1: Added 'authenticate' middleware to this route.
// FIX 2: Moved this specific route BEFORE the wildcard '/:slug' route below.
router.route('/').get(authenticate, getAllCreatorVideos);

// @desc    Monetize a new video (handles both youtube and direct)
// @route   POST /api/v1/videos
// @access  Private
router.route('/').post(authenticate, createVideo);

// @desc    Get a presigned URL for a direct S3 upload
// @route   POST /api/v1/videos/generate-upload-url
// @access  Private
router.route('/generate-upload-url').post(authenticate, generateUploadUrl);

// @desc    Stream a directly monetized video from S3
// @route   GET /api/v1/videos/stream/:slug
// @access  Private (via short-lived token)
router.route('/stream/:slug').get(streamVideo);

// @desc    Get the public details of a video for a sales page
// @route   GET /api/v1/videos/:slug
// @access  Public
router.route('/:slug').get(getVideoBySlug);

// @desc    Delete a monetized video
// @route   DELETE /api/v1/videos/:id
// @access  Private
router.route('/:id').delete(authenticate, deleteVideo);


module.exports = router;