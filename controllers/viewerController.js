// const asyncHandler = require('express-async-handler');
// const Video = require('../models/Video');
// const Bundle = require('../models/Bundle'); // Import Bundle model
// const Transaction = require('../models/Transaction');

// // @desc    Get viewer's purchased videos and suggested content
// // @route   GET /api/v1/viewer/library
// // @access  Private (Viewer)
// const getLibraryData = asyncHandler(async (req, res) => {
//     // 1. Find all successful transactions for the logged-in user
//     const successfulTransactions = await Transaction.find({
//         user: req.user.id,
//         status: 'successful',
//     });

//     // 2. Extract product IDs from those transactions, distinguishing between videos and bundles
//     const purchasedVideoIdsFromTransactions = successfulTransactions
//         .filter(t => t.productType === 'Video')
//         .map(t => t.product);

//     const purchasedBundleIds = successfulTransactions
//         .filter(t => t.productType === 'Bundle')
//         .map(t => t.product);

//     // 3. Fetch full details for purchased videos
//     const purchasedVideos = await Video.find({
//         '_id': { $in: purchasedVideoIdsFromTransactions }
//     }).populate('creator', 'userName');

//     // 4. Fetch full details for purchased bundles
//     const purchasedBundles = await Bundle.find({
//         '_id': { $in: purchasedBundleIds }
//     }).populate('creator', 'userName')
//       .populate('videos', 'title thumbnailUrl shareableSlug sourceType'); // Populate videos inside bundles

//     // Combine all unique video IDs from direct purchases and within purchased bundles
//     let allAccessedVideoIds = new Set();
//     purchasedVideos.forEach(v => allAccessedVideoIds.add(v._id.toString()));
//     purchasedBundles.forEach(bundle => {
//         bundle.videos.forEach(video => allAccessedVideoIds.add(video._id.toString()));
//     });

//     // 5. Fetch some other videos to suggest (that the user hasn't bought or accessed via bundle)
//     const suggestedVideos = await Video.find({
//         '_id': { $nin: Array.from(allAccessedVideoIds) } // Exclude all videos user already owns/accessed
//     }).populate('creator', 'firstName lastName userName').limit(10).sort({ createdAt: -1 });

//     res.status(200).json({ 
//         purchasedVideos, 
//         purchasedBundles, 
//         suggestedVideos 
//     });
// });

// module.exports = {
//     getLibraryData,
// };










const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Bundle = require('../models/Bundle');
const Transaction = require('../models/Transaction');

const getLibraryData = asyncHandler(async (req, res) => {
    // 1. Find all successful transactions (this part is correct)
    const successfulTransactions = await Transaction.find({
        user: req.user.id,
        status: 'successful',
    });

    // 2. Extract product IDs (this part is correct)
    const purchasedVideoIds = successfulTransactions
        .filter(t => t.productType === 'Video')
        .map(t => t.product);

    const purchasedBundleIds = successfulTransactions
        .filter(t => t.productType === 'Bundle')
        .map(t => t.product);

    // 3. Fetch purchased videos and bundles in parallel
    const [purchasedVideos, purchasedBundles] = await Promise.all([
        Video.find({ '_id': { $in: purchasedVideoIds } })
             // --- REFINEMENT 1: Populate full name for consistency ---
            .populate('creator', 'firstName lastName userName'),
        Bundle.find({ '_id': { $in: purchasedBundleIds } })
            .populate('creator', 'firstName lastName userName')
            .populate('videos', 'title thumbnailUrl shareableSlug sourceType')
    ]);

    // 4. Combine all unique video IDs for suggestions (this logic is correct)
    let allAccessedVideoIds = new Set();
    purchasedVideos.forEach(v => allAccessedVideoIds.add(v._id.toString()));
    purchasedBundles.forEach(bundle => {
        bundle.videos.forEach(video => allAccessedVideoIds.add(video._id.toString()));
    });

    // 5. Fetch suggested videos (this is also correct)
    const suggestedVideos = await Video.find({
        '_id': { $nin: Array.from(allAccessedVideoIds) }
    }).populate('creator', 'firstName lastName userName').limit(10).sort({ createdAt: -1 });

    res.status(200).json({ 
        purchasedVideos, 
        purchasedBundles, 
        suggestedVideos 
    });
});

module.exports = {
    getLibraryData,
};