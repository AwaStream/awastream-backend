const express = require('express');
const router = express.Router();
const {
    createVideo,
    getVideoBySlug,
    generateUploadUrl,
    streamVideo,
} = require('../controllers/videoController');

const { authenticate } = require('../middleware/authMiddleware');

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
// NOTE: This route is NOT protected by the standard `authenticate` middleware.
// Its security is handled by the JWT token in the query string.
router.route('/stream/:slug').get(streamVideo);

// @desc    Get the public details of a video for a sales page
// @route   GET /api/v1/videos/:slug
// @access  Public
router.route('/:slug').get(getVideoBySlug);

// The old '/:slug/access' route is no longer needed and has been removed.

module.exports = router;