const express = require('express');
const router = express.Router();
const { createVideo, getVideoBySlug, checkVideoAccess } = require('../controllers/videoController');
const { authenticate, authorize } = require('../middleware/authMiddleware');

router.post('/', authenticate, authorize('creator', 'superadmin'), createVideo);
router.get('/:slug', getVideoBySlug);
router.get('/:slug/access-status', authenticate, checkVideoAccess);

module.exports = router;



// HLS Version
// const express = require('express');
// const router = express.Router();
// const { createVideo, getVideoBySlug, checkVideoAccess, getHlsKey } = require('../controllers/videoController');
// const { authenticate, authorize } = require('../middleware/authMiddleware');

// router.post('/', authenticate, authorize('creator', 'superadmin'), createVideo);
// router.get('/:slug', getVideoBySlug);
// router.get('/:slug/access-status', authenticate, checkVideoAccess);
// router.get('/key/:videoId', authenticate, getHlsKey); // The secure key-serving route

// module.exports = router;