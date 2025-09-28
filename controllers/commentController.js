const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Transaction = require('../models/Transaction');
const Video = require('../models/Video'); // Import the Video model

/**
 * @desc    Get all comments for a video
 * @route   GET /api/comments/:videoId
 * @access  Private (Viewer with access)
 */
const getVideoComments = asyncHandler(async (req, res) => {
    const comments = await Comment.find({ video: req.params.videoId })
        .populate('user', 'userName avatarUrl')
        .sort({ createdAt: 'desc' });
    res.status(200).json(comments);
});

/**
 * @desc    Create a new comment on a video
 * @route   POST /api/comments/:videoId
 * @access  Private (Viewer with access)
 */
const createComment = asyncHandler(async (req, res) => {
    const { text } = req.body;
    const videoId = new mongoose.Types.ObjectId(req.params.videoId);
    const userId = new mongoose.Types.ObjectId(req.user.id);

    if (!text) {
        res.status(400);
        throw new Error('Comment text cannot be empty.');
    }

    const purchase = await Transaction.findOne({
        user: userId,
        product: videoId, // Match against the generic product field
        productType: 'Video',
        status: 'successful',
    });

    if (!purchase) {
        res.status(403);
        throw new Error('You must purchase this video to comment.');
    }

    const comment = await Comment.create({
        video: videoId,
        user: userId,
        text,
    });
    
    // --- UPDATE: Increment commentCount on the Video model ---
    await Video.findByIdAndUpdate(videoId, { $inc: { commentCount: 1 } });

    const newComment = await Comment.findById(comment._id).populate('user', 'userName avatarUrl');

    res.status(201).json(newComment);
});

/**
 * @desc    Delete a comment
 * @route   DELETE /api/comments/:commentId
 * @access  Private (Comment owner or Video creator)
 */
const deleteComment = asyncHandler(async (req, res) => {
    const comment = await Comment.findById(req.params.commentId).populate('video');

    if (!comment) {
        res.status(404);
        throw new Error('Comment not found');
    }

    // Check if the user is the owner of the comment OR the creator of the video
    const isCommentOwner = comment.user.toString() === req.user.id;
    const isVideoCreator = comment.video.creator.toString() === req.user.id;

    if (!isCommentOwner && !isVideoCreator) {
        res.status(401);
        throw new Error('Not authorized to delete this comment');
    }

    await comment.deleteOne();
    
    // --- UPDATE: Decrement commentCount on the Video model ---
    await Video.findByIdAndUpdate(comment.video._id, { $inc: { commentCount: -1 } });

    res.status(200).json({ message: 'Comment removed successfully' });
});


module.exports = { getVideoComments, createComment, deleteComment };