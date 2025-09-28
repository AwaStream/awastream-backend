// const mongoose = require('mongoose');

// const TransactionSchema = new mongoose.Schema({
//     viewer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
//     creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
//     video: { type: mongoose.Schema.Types.ObjectId, ref: 'Video', required: true },
//     amountKobo: { type: Number, required: true }, // Gross amount paid by viewer
//     commissionKobo: { type: Number }, // AwaStream's 15% cut
//     creatorEarningsKobo: { type: Number }, // The 85% net for the creator
//     status: {
//         type: String,
//         enum: ['pending', 'successful', 'failed'],
//         default: 'pending'
//     },
//     internalRef: { type: String, required: true, unique: true }, 
//     providerRef: { type: String }, 
//     paymentMethod: { type: String },
//       paymentProvider: {
//         type: String,
//         enum: ['paystack', 'stripe', 'flutterwave'],
//         required: true,
//     },
// }, { timestamps: true });

// const Transaction = mongoose.model('Transaction', TransactionSchema);
// module.exports = Transaction;






const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    
    product: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
        refPath: 'productType'
    },
    productType: {
        type: String,
        required: true,
        enum: ['Video', 'Bundle']
    },

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
        enum: ['paystack', 'stripe', 'flutterwave'],
        required: true,
    },
}, { timestamps: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
module.exports = Transaction;