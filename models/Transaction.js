const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
    amountKobo: { type: Number, required: true }, // Gross amount paid by viewer
    commissionKobo: { type: Number, required: true }, // AwaStream's 15% cut
    creatorEarningsKobo: { type: Number, required: true }, // The 85% net for the creator
    status: {
        type: String,
        enum: ['pending', 'successful', 'failed'],
        default: 'pending'
    },
    internalRef: { type: String, required: true, unique: true }, 
    providerRef: { type: String }, 
    paymentMethod: { type: String },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;