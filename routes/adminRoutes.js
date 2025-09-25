const express = require('express');
const router = express.Router();
const { getAdminDashboard, getCreatorDetails, getAllViewers, approvePayout, getAllUsers, updateUserStatus, rejectPayout, getPayouts } = require('../controllers/adminController');
const { getSettings, updateSettings, updateAdminProfile } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes in this file require a user to be authenticated and have the 'superadmin' role
router.use(authenticate, authorize('superadmin'));

router.get('/dashboard', getAdminDashboard);

router.get('/creators/:id/details', getCreatorDetails);
router.get('/viewers/:id/details', getAllViewers)

router.get('/payouts', getPayouts);
router.put('/payouts/:id/approve', approvePayout);
router.put('/payouts/:id/reject', rejectPayout)

router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

// Settings Routes
router.route('/settings').get(getSettings).put(updateSettings);

// Admin Profile Route
router.put('/profile', updateAdminProfile);

module.exports = router;