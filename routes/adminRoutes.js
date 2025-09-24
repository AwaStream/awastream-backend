const express = require('express');
const router = express.Router();
const { getAdminDashboard, approvePayout, getAllUsers, updateUserStatus, rejectPayout, getPayouts } = require('../controllers/adminController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

// All routes in this file require a user to be authenticated and have the 'superadmin' role
router.use(authenticate, authorize('superadmin'));

router.get('/dashboard', getAdminDashboard);

router.get('/payouts', getPayouts);
router.put('/payouts/:id/approve', approvePayout);
router.put('/payouts/:id/reject', rejectPayout)

router.get('/users', getAllUsers);
router.put('/users/:id/status', updateUserStatus);

module.exports = router;