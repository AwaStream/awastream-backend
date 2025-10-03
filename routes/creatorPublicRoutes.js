// routes/creatorPublicRoutes.js
const express = require('express');
const router = express.Router();
const {  profileRedirect } = require('../controllers/creatorController');

router.get('/:username', profileRedirect);

module.exports = router;