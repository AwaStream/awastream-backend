const mongoose = require('mongoose');
const SettingsSchema = new mongoose.Schema({
    paymentProvider: { type: String, enum: ['paystack', 'stripe'], default: 'paystack' },
    payoutType: { type: String, enum: ['manual', 'automatic'], default: 'manual' }
});
const Settings = mongoose.model('Settings', SettingsSchema);
module.exports = Settings;