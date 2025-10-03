const asyncHandler = require('express-async-handler');
const Notification = require('../models/Notification');

const getNotifications = asyncHandler(async (req, res) => {
    const notifications = await Notification.find({ user: req.user._id })
        .sort({ createdAt: -1 })
        .limit(30); // Get the latest 30

    const unreadCount = await Notification.countDocuments({
        user: req.user._id,
        isRead: false
    });

    res.status(200).json({ notifications, unreadCount });
});

const markAsRead = asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
        { _id: req.params.id, user: req.user._id }, // Ensure user owns the notification
        { isRead: true },
        { new: true }
    );

    if (!notification) {
        res.status(404);
        throw new Error('Notification not found');
    }
    res.status(200).json(notification);
});

const markAllAsRead = asyncHandler(async (req, res) => {
    await Notification.updateMany(
        { user: req.user._id, isRead: false },
        { $set: { isRead: true } }
    );
    res.status(200).json({ message: 'All notifications marked as read.' });
});

module.exports = { getNotifications, markAsRead, markAllAsRead };