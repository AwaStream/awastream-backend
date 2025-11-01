const mongoose = require('mongoose');

const BundleSchema = new mongoose.Schema({
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    title: { 
        type: String, 
        required: true, 
        trim: true 
    },
    description: { 
        type: String, 
        trim: true 
    },
    thumbnailUrl: { 
        type: String, 
        required: true 
    },
    priceNaira: { 
        type: Number, 
        required: true, 
        min: [100, 'Bundle price must be at least 100 Naira'] // Minimum price for a bundle
    },
    priceKobo: { 
        type: Number, 
        required: true 
    },
    shareableSlug: { 
        type: String, 
        required: true, 
        unique: true, 
        index: true 
    },
    videos: [{ // An array of ObjectIds referencing individual Video documents
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: false
    }],
    isActive: { 
        type: Boolean, 
        default: true 
    },
    // Optional: Add some aggregate stats for bundles similar to videos
    totalSales: {
        type: Number,
        default: 0
    },
}, { timestamps: true });

const Bundle = mongoose.model('Bundle', BundleSchema);
module.exports = Bundle;