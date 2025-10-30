const express = require('express');
const router = express.Router();
const {
    createVideo,
    getVideoBySlug,
    generateUploadUrl,
    streamVideo,
    updateVideo,
    deleteVideo,
    getAllCreatorVideos,
    getVideoStats,
    getDailyPerformance,
    getVideoTransactions,
    getPlaybackDetails, 
    getTrailerStream,
} = require('../controllers/videoController');
const { authenticate } = require('../middleware/authMiddleware');
const { 
    startWatchSession, 
    sendWatchHeartbeat, 
    endWatchSession 
} = require('../controllers/analyticsController');

router.route('/')
    .get(authenticate, getAllCreatorVideos)
    .post(authenticate, createVideo);

// --- Specific action routes ---
router.post('/generate-upload-url', authenticate, generateUploadUrl);
router.get('/stream/:slug', streamVideo);

router.get('/access/:slug', authenticate, getPlaybackDetails);
router.get('/trailer/:slug', getTrailerStream);
// --- Slug-based routes MUST come before the generic '/:slug' route ---
router.get('/:slug/stats', authenticate, getVideoStats);
router.get('/:slug/transactions', authenticate, getVideoTransactions);
router.get('/:slug/daily-performance', authenticate, getDailyPerformance);

// --- FIX: Generic public and protected routes ---
router.route('/:slug')
    .get(getVideoBySlug)
    .put(authenticate, updateVideo)
    .delete(authenticate, deleteVideo); 
// @desc    Tells the server the user has started playing a video
router.post('/analytics/start', authenticate, startWatchSession);

// @route   POST /api/videos/analytics/heartbeat
// @desc    Sent every 30-60s to prove the user is still watching
router.post('/analytics/heartbeat', authenticate, sendWatchHeartbeat);

// @route   POST /api/videos/analytics/end
// @desc    Tells the server the user has stopped watching (closed tab, etc.)
router.post('/analytics/end', authenticate, endWatchSession);

module.exports = router;