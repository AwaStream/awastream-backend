const express = require('express');
const router = express.Router();
const { getAdminDashboard, getCreatorDetails, getAllViewers, approvePayout, verifyPayoutStatus, getAllUsers,getOnboarderDetails, getOnboarders,updateUserRole,  updateUserStatus, rejectPayout, getPayouts } = require('../controllers/adminController');
const { getSettings, updateSettings, updateAdminProfile } = require('../controllers/settingsController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes in this file require a user to be authenticated a,nd have the 'superadmin' role
router.use(authenticate, authorize('superadmin'));

router.get('/dashboard', getAdminDashboard);

router.get('/creators/:id/details', getCreatorDetails);

router.get('/viewers', getAllViewers); 

router.get('/payouts', getPayouts);
router.put('/payouts/:id/approve', approvePayout);
router.put('/payouts/:id/reject', rejectPayout)
router.put('/payouts/:id/verify', verifyPayoutStatus);

router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

router.get('/onboarders', getOnboarders);
router.get('/onboarders/:id', getOnboarderDetails);
router.put('/users/:id/role', updateUserRole);

// Settings Routes
router.route('/settings').get(getSettings).put(updateSettings);

// Admin Profile Route
router.put('/profile', updateAdminProfile);

module.exports = router;