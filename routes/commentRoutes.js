const express = require('express');
const router = express.Router();
const { getVideoComments, createComment, deleteComment } = require('../controllers/commentController');
const { authenticate } = require('../middleware/authMiddleware');

router.route('/:videoId')
    .get(authenticate, getVideoComments)
    .post(authenticate, createComment);

router.route('/:commentId').delete(authenticate, deleteComment);

module.exports = router;