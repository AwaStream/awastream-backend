const mongoose = require('mongoose');

const VideoSchema = new mongoose.Schema({
    creator: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },

    sourceType: {
        type: String,
        enum: ['youtube', 'direct'],
        required: true
    },
    sourceId: {
        type: String,
        required: true
    },

    title: { type: String, required: true },
    description: { type: String },
    thumbnailUrl: { type: String, required: true },
    priceNaira: { type: Number, required: true },
    priceKobo: { 
        type: Number, 
        required: true 
  },
    shareableSlug: { type: String, required: true, unique: true },
    isActive: { type: Boolean, default: true },
    
}, { timestamps: true });

const Video = mongoose.model('Video', VideoSchema);
module.exports = Video;