const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({    
       user: { 
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true 
        },
        creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

        product: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            refPath: 'productType',
            index: true
        },
    productType: {
        type: String,
        required: true,
        enum: ['Video', 'Bundle']
    },

    productTitle: { type: String, required: true },

    amountKobo: { type: Number, required: true }, 
    commissionKobo: { type: Number, default: 0 }, 
    creatorEarningsKobo: { type: Number, default: 0 },

    status: {
        type: String,
        enum: ['pending', 'successful', 'failed', 'refunded'],
        default: 'pending'
    },
    internalRef: { type: String, required: true, unique: true }, 
    providerRef: { type: String },
    paymentMethod: { type: String },
    paymentProvider: {
        type: String,
        enum: ['paystack', 'nomba', 'stripe', 'flutterwave'],
        required: true,
    },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;