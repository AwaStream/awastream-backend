const express = require('express');
const router = express.Router();
const { generateToken, checkAccess } = require('../controllers/accessController');
const { authenticate } = require('../middleware/authMiddleware');

// @desc    Generate a secure, short-lived token for a user to access a video
// @route   POST /api/v1/access/generate-token
// @access  Private
router.route('/generate-token').post(authenticate, generateToken);

router.route('/check/:productType/:slug').get(authenticate, checkAccess);

module.exports = router;