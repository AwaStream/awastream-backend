const mongoose = require('mongoose');

const PayoutSchema = new mongoose.Schema({
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    amountKobo: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'failed', 'rejected'],
        default: 'pending'
    },
    // Reference from the disbursement provider (e.g., Paystack).
    providerRef: { type: String },
    // Admin who approved the payout.
    approvedBy: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User' 
    }, 
    processedAt: { type: Date },
      notes: { type: String },
}, { timestamps: true });

const Payout = mongoose.model('Payout', PayoutSchema);
module.exports = Payout;