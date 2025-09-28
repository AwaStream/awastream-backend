// routes/creatorPublicRoutes.js
const express = require('express');
const router = express.Router();
const { getPublicCreatorProfile } = require('../controllers/creatorController');

router.get('/:username', getPublicCreatorProfile);

module.exports = router;