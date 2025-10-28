const mongoose = require('mongoose');

const videoViewSchema = new mongoose.Schema({
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
    },
    // Store a hash of the IP for privacy, not the raw IP
    viewerIp: {
        type: String,
        required: true,
    },
}, { timestamps: true });

videoViewSchema.index({ video: 1, viewerIp: 1 }, { unique: true });

module.exports = mongoose.model('VideoView', videoViewSchema);