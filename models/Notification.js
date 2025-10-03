const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
    user: { // The creator who receives the notification
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true,
        index: true,
    },
    type: {
        type: String,
        required: true,
        enum: [
            'new_sale',
            'new_comment',
            'new_reply',
            'payout_success',
            'payout_failed',
            // Add other types as your app grows
        ]
    },
    message: { 
        type: String, 
        required: true 
    },
    link: { // A URL to navigate to when the notification is clicked
        type: String 
    },
    isRead: { 
        type: Boolean, 
        default: false 
    },
}, { timestamps: true });

const Notification = mongoose.model('Notification', NotificationSchema);
module.exports = Notification;