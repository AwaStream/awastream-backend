const mongoose = require('mongoose');

const SettingsSchema = new mongoose.Schema({
    singleton: { type: String, default: 'main_settings', unique: true },
    
    // Controls which gateway handles NEW incoming payments (Checkout)
    incomingPaymentProvider: { 
        type: String, 
        enum: ['paystack', 'nomba', 'stripe'], 
        default: 'nomba' 
    },

    // Controls which gateway handles OUTGOING transfers to creators
    payoutProvider: { 
        type: String, 
        enum: ['paystack', 'nomba'], 
        default: 'nomba' // Defaulting to Nomba as requested
    },
    
    payoutType: { type: String, enum: ['manual', 'automatic'], default: 'manual' },
    emailProvider: { type: String, enum: ['nodemailer', 'brevo', 'mailjet'], default: 'mailjet' },
});

const Settings = mongoose.model('Settings', SettingsSchema);
module.exports = Settings;