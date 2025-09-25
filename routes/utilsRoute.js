// Create a new file: routes/utilsRoutes.js
const express = require('express');
const router = express.Router();
const { getBankList } = require('../controllers/utilsController');

router.get('/banks', getBankList);

module.exports = router;