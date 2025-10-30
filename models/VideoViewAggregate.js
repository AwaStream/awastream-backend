const mongoose = require('mongoose');

const VideoViewAggregateSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
    },
    // This flag ensures we only count the unique view ONCE
    viewCounted: {
        type: Boolean,
        default: false,
    },
    // The total cumulative time watched, in seconds
    totalWatchTimeInSeconds: {
        type: Number,
        default: 0,
    },
    // The highest timestamp the user has ever reached
    maxDurationReached: {
        type: Number,
        default: 0,
    },
    viewCountedAt: {
        type: Date,
        default: null,
    },
}, { timestamps: true });

// This unique index is the *core* of the entire system.
// It physically prevents more than one row per user/video pair.
VideoViewAggregateSchema.index({ user: 1, video: 1 }, { unique: true });

module.exports = mongoose.model('VideoViewAggregate', VideoViewAggregateSchema);