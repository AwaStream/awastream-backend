const express = require('express');
const router = express.Router();
const { createVideo, getVideoBySlug, checkVideoAccess } = require('../controllers/videoController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// Monetize a new video (only creators can do this)
router.post('/', authenticate, authorize('creator'), createVideo);

// Get a video's public details
router.get('/:slug', getVideoBySlug);

// Get a video access status
router.get('/:slug/access-status', authenticate, checkVideoAccess);

module.exports = router;