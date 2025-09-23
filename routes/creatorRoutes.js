const express = require('express');
const router = express.Router();
const { getCreatorDashboard, getCreatorProfile, updateCreatorProfile, requestPayout } = require('../controllers/creatorController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes in this file require a user to be authenticated and have the 'creator' role
router.use(authenticate, authorize('creator'));

router.get('/dashboard', getCreatorDashboard);
router.route('/profile').get(getCreatorProfile).put(updateCreatorProfile);
router.post('/payouts', requestPayout);

module.exports = router;