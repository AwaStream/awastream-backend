const asyncHandler = require('express-async-handler');
const Settings = require('../models/Settings');
const User = require('../models/User');

// @desc    Get platform settings
// @route   GET /api/v1/admin/settings
// @access  Private (Superadmin)
const getSettings = asyncHandler(async (req, res) => {
    const settings = await Settings.findOneAndUpdate(
        { singleton: 'main_settings' }, 
        { $setOnInsert: { singleton: 'main_settings' } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    res.status(200).json(settings);
});

// @desc    Update platform settings
// @route   PUT /api/v1/admin/settings
// @access  Private (Superadmin)
const updateSettings = asyncHandler(async (req, res) => {
    const { paymentProvider, payoutType, emailProvider } = req.body;
    const updates = {};
    if (paymentProvider) updates.paymentProvider = paymentProvider;
    if (payoutType) updates.payoutType = payoutType;
    if (emailProvider) updates.emailProvider = emailProvider;

    const settings = await Settings.findOneAndUpdate(
        { singleton: 'main_settings' },
        { $set: updates },
        { new: true, runValidators: true }
    );
    res.status(200).json(settings);
});

// @desc    Update admin's own profile
// @route   PUT /api/v1/admin/profile
// @access  Private (Superadmin)
const updateAdminProfile = asyncHandler(async (req, res) => {
    const { firstName, lastName, userName, email } = req.body;
    const admin = await User.findByIdAndUpdate(
        req.user.id,
        { $set: { firstName, lastName, userName, email } },
        { new: true, runValidators: true }
    ).select('firstName lastName userName email');
    res.status(200).json(admin);
});

module.exports = { 
    getSettings, 
    updateSettings, 
    updateAdminProfile 
};