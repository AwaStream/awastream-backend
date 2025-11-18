const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // One main NGN wallet per user
    },
    balanceKobo: {
        type: Number,
        default: 0,
        min: 0 // Prevent negative balances at the schema level
    },
    currency: {
        type: String,
        default: 'NGN',
        enum: ['NGN']
    },
    // Stores the Nomba Virtual Account details
    accountDetails: {
        bankName: { type: String },
        accountName: { type: String },
        accountNumber: { type: String },
        accountRef: { type: String } // Our unique reference (e.g., WALLET-USERID)
    },
    // To track daily transaction limits if needed
    dailyTotalKobo: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Wallet', WalletSchema);