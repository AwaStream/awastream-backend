const express = require('express');
const router = express.Router();
const {
    getNotifications,
    markAsRead,
    markAllAsRead
} = require('../controllers/notificationController');
const { authenticate } = require('../middleware/authMiddleware'); // Use your AwaStream auth middleware

router.route('/')
    .get(authenticate, getNotifications);

router.route('/read-all')
    .put(authenticate, markAllAsRead);
    
router.route('/:id/read')
    .put(authenticate, markAsRead);

module.exports = router;