const express = require('express');
const router = express.Router();
const { getLibraryData } = require('../controllers/viewerController');
const { authenticate } = require('../middleware/authMiddleware');

// This route is protected, so only logged-in users can access their library.
router.get('/library', authenticate, getLibraryData);

module.exports = router;