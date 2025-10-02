const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema({
    video: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Video',
        required: true,
    },
    user: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    text: {
        type: String,
        required: [true, 'Comment text is required'],
        trim: true,
    },

     parent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Comment',
        default: null, // Top-level comments will have a null parent
    },
    // --- NEW FIELD: To track the number of direct replies ---
    replyCount: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

module.exports = mongoose.model('Comment', commentSchema);