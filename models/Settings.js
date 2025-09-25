const mongoose = require('mongoose');
const SettingsSchema = new mongoose.Schema({

     singleton: { type: String, default: 'main_settings', unique: true }, 
    
    paymentProvider: { type: String, enum: ['paystack', 'stripe'], default: 'paystack' },
    payoutType: { type: String, enum: ['manual', 'automatic'], default: 'manual' }
});
const Settings = mongoose.model('Settings', SettingsSchema);
module.exports = Settings;