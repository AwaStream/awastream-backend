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
} = require('../controllers/videoController');
const { authenticate } = require('../middleware/authMiddleware');

router.route('/')
    .get(authenticate, getAllCreatorVideos)
    .post(authenticate, createVideo);

// --- Specific action routes ---
router.post('/generate-upload-url', authenticate, generateUploadUrl);
router.get('/stream/:slug', streamVideo);

// --- Slug-based routes MUST come before the generic '/:slug' route ---
router.get('/:slug/stats', authenticate, getVideoStats);
router.get('/:slug/transactions', authenticate, getVideoTransactions);
router.get('/:slug/daily-performance', authenticate, getDailyPerformance);

// --- FIX: Generic public and protected routes ---
router.route('/:slug')
    .get(getVideoBySlug)
    .put(authenticate, updateVideo)
    .delete(authenticate, deleteVideo); 

module.exports = router;