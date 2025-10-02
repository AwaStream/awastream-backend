const express = require('express');
const router = express.Router();
const {
    createBundle,
    getBundleBySlug,
    getAllCreatorBundles,
    deleteBundle,
    reorderBundleVideos,
    addVideoToBundle,
    removeVideoFromBundle,
} = require('../controllers/bundleController');
const { authenticate } = require('../middleware/authMiddleware');

router.route('/')
    .get(authenticate, getAllCreatorBundles) // Get all bundles for a creator
    .post(authenticate, createBundle);       // Create a new bundle

    router.put('/:bundleSlug/videos/reorder', authenticate, reorderBundleVideos);

// --- NEW ROUTES FOR ADDING/REMOVING A SPECIFIC VIDEO ---
router.route('/:bundleSlug/videos/:videoId')
    .post(authenticate, addVideoToBundle)
    .delete(authenticate, removeVideoFromBundle);

router.route('/:slug')
    .get(getBundleBySlug)                    // Get public details of a single bundle
    .delete(authenticate, deleteBundle);     // Delete a bundle (by creator)

module.exports = router;