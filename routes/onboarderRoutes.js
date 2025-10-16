const express = require('express');
const router = express.Router();
const { getOnboarderDashboard } = require('../controllers/onboarderController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes in this file require a user to be authenticated and have the 'onboarder' role
router.use(authenticate, authorize('onboarder'));

router.get('/dashboard', getOnboarderDashboard);

module.exports = router;