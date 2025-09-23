const Notification = require('../models/Notification');

/**
 * Creates and saves a notification in the database.
 * @param {string} userId - The ID of the user to notify.
 * @param {string} organizationId - The ID of the related organization.
 * @param {string} type - The type of notification (e.g., 'form_submission').
 * @param {string} message - The notification message.
 * @param {string} [link] - An optional link for the notification.
 */
const createNotification = async (userId, organizationId, type, message, link) => {
    try {
        if (!userId || !organizationId || !type || !message) {
            console.error('Missing required parameters for notification creation.');
            return;
        }
        
        const notification = new Notification({
            user: userId,
            creator: creatorId,
            type,
            message,
            link,
        });
        
        await notification.save();

    } catch (error) {
        console.error('Error creating notification:', error);
    }
};

module.exports = createNotification;