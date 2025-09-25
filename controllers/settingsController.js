const asyncHandler = require('express-async-handler');
const Settings = require('../models/Settings');
const User = require('../models/User');

// @desc    Get platform settings
// @route   GET /api/v1/admin/settings
// @access  Private (Superadmin)
const getSettings = asyncHandler(async (req, res) => {
    // findOneAndUpdate with upsert ensures a settings document is created if it doesn't exist
    const settings = await Settings.findOneAndUpdate(
        { singleton: 'main_settings' }, 
        { $setOnInsert: { singleton: 'main_settings' } }, // Only sets on creation
        { new: true, upsert: true }
    );
    res.status(200).json(settings);
});

// @desc    Update platform settings
// @route   PUT /api/v1/admin/settings
// @access  Private (Superadmin)
const updateSettings = asyncHandler(async (req, res) => {
    const { paymentProvider, payoutType } = req.body;
    const settings = await Settings.findOneAndUpdate(
        { singleton: 'main_settings' },
        { $set: { paymentProvider, payoutType } },
        { new: true }
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

module.exports = { getSettings, updateSettings, updateAdminProfile };