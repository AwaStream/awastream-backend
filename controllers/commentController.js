const Notification = require('../models/Notification');
const User = require('../models/User');
const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Comment = require('../models/Comment');
const Transaction = require('../models/Transaction');
const Video = require('../models/Video');




const createComment = asyncHandler(async (req, res) => {
    const { text, parentId } = req.body;
    const videoId = req.params.videoId;
    const userId = req.user.id;

    if (!text) {
        res.status(400);
        throw new Error('Comment text cannot be empty.');
    }

    const video = await Video.findById(videoId);
    if (!video) {
        res.status(404);
        throw new Error('Video not found.');
    }

    let hasAccess = false;
    const isCreator = video.creator.toString() === userId;

    if (isCreator) {
        hasAccess = true;
    } else {
        const purchase = await Transaction.findOne({
            user: userId,
            product: videoId,
            productType: 'Video',
            status: 'successful',
        });
        if (purchase) {
            hasAccess = true;
        }
    }

    if (!hasAccess) {
        res.status(403);
        throw new Error('You must purchase this video to comment.');
    }

    const commentPayload = {
        video: videoId,
        user: userId,
        text,
    };

     if (parentId) {
        const parentComment = await Comment.findById(parentId);
        if (!parentComment) {
            res.status(404);
            throw new Error('Parent comment not found.');
        }
        commentPayload.parent = parentId;
        // Increment the reply count on the parent comment
        await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: 1 } });
    } else {
        // Only increment the video's comment count for top-level comments
        await Video.findByIdAndUpdate(videoId, { $inc: { commentCount: 1 } });
    }

    const comment = await Comment.create(commentPayload);
    const newComment = await Comment.findById(comment._id).populate('user', 'firstName lastName avatarUrl role'); // Changed 'author' to 'user'

    if (parentId) {
    // It's a reply
    const parentComment = await Comment.findById(parentId).populate('user');
    // Notify the original commenter (if they are not the one replying)
    if (parentComment.user._id.toString() !== userId) {
        await Notification.create({
            user: parentComment.user._id,
            type: 'new_reply',
            message: `${req.user.firstName} replied to your comment on "${video.title}"`,
            link: `/view/video/${video.shareableSlug}`
        });
    }
} else {
    // It's a top-level comment, notify the video creator
    await Notification.create({
        user: video.creator,
        type: 'new_comment',
        message: `${req.user.firstName} commented on your video: "${video.title}"`,
        link: `/view/video/${video.shareableSlug}`
    });
}
    res.status(201).json(newComment);
});


const getVideoComments = asyncHandler(async (req, res) => {
    // 1. Fetch all comments for the video
    const comments = await Comment.find({ video: req.params.videoId })
        .populate('user', 'firstName lastName avatarUrl role')
        .sort({ createdAt: 'asc' }); // Sort by oldest first to build the tree correctly

    // 2. Build the nested comment tree
    const commentMap = {};
    const commentTree = [];

    // First pass: create a map of all comments by their ID
    comments.forEach(comment => {
        comment = comment.toObject(); // Convert to plain object to add properties
        comment.replies = [];
        commentMap[comment._id] = comment;
    });

    // Second pass: link replies to their parents
    comments.forEach(comment => {
        if (comment.parent) {
            // It's a reply, so add it to the parent's 'replies' array
            if (commentMap[comment.parent]) {
                commentMap[comment.parent].replies.push(commentMap[comment._id]);
            }
        } else {
            // It's a top-level comment
            commentTree.push(commentMap[comment._id]);
        }
    });

    res.status(200).json(commentTree);
});

const deleteComment = asyncHandler(async (req, res) => {
    const comment = await Comment.findById(req.params.commentId).populate('video');

    if (!comment) {
        res.status(404);
        throw new Error('Comment not found');
    }

    const isCommentOwner = comment.user.toString() === req.user.id;
    const isVideoCreator = comment.video.creator.toString() === req.user.id;

    if (!isCommentOwner && !isVideoCreator) {
        res.status(401);
        throw new Error('Not authorized to delete this comment');
    }

    // If the comment has replies, soft delete it to preserve the thread
    if (comment.replyCount > 0) {
        comment.text = '[This comment has been removed]';
        comment.user = null; // Anonymize the author
        await comment.save();
    } else {
        // If it has no replies, hard delete it
        const videoId = comment.video._id;
        const parentId = comment.parent;

        await comment.deleteOne();
        
        // If it was a top-level comment, decrement the video's count
        if (!parentId) {
            await Video.findByIdAndUpdate(videoId, { $inc: { commentCount: -1 } });
        } else {
            // If it was a reply, decrement the parent's reply count
            await Comment.findByIdAndUpdate(parentId, { $inc: { replyCount: -1 } });
        }
    }

    res.status(200).json({ message: 'Comment removed successfully' });
});

module.exports = { getVideoComments, createComment, deleteComment };