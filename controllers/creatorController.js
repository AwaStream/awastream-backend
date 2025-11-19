// const asyncHandler = require('express-async-handler');
// const mongoose = require('mongoose');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const Payout = require('../models/Payout');
// const User = require('../models/User');
// const UsernameHistory = require('../models/UsernameHistory');
// const Settings = require('../models/Settings');
// const payoutService = require('../services/payoutService');
// const { startOfDay, subDays } = require('date-fns');

// const Bundle = require('../models/Bundle');
// const VideoViewAggregate = require('../models/VideoViewAggregate')

// const getCreatorDashboard = asyncHandler(async (req, res) => {
//     const creatorId = new mongoose.Types.ObjectId(req.user.id);
//     const revenueAggregation = await Transaction.aggregate([
//         { $match: { creator: creatorId, status: 'successful' } },
//         { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
//     ]);
//     const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
//     const payoutAggregation = await Payout.aggregate([
//         { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } },
//         { $group: { _id: null, total: { $sum: '$amountKobo' } } }
//     ]);
//     const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
//     const totalSales = await Transaction.countDocuments({ creator: creatorId, status: 'successful' });
//     const monetizedVideosCount = await Video.countDocuments({ creator: creatorId });
//     const recentVideos = await Video.find({ creator: creatorId }).sort({ createdAt: -1 }).limit(5);

//     res.status(200).json({
//         totalRevenueKobo,
//         totalPayoutsKobo,
//         availableBalanceKobo: totalRevenueKobo - totalPayoutsKobo,
//         totalSales,
//         monetizedVideosCount,
//         recentVideos,
//     });
// });

// /**
//  * @desc    Get comprehensive analytics for a creator.
//  * @route   GET /api/creator/analytics
//  * @access  Private (Creator)
//  */
// const getCreatorAnalytics = asyncHandler(async (req, res) => {
//     const creatorId = new mongoose.Types.ObjectId(req.user.id);
//     const range = req.query.range || '30d'; // Default to 30 days

//     let startDate;
//     const endDate = new Date();

//     if (range === '7d') {
//         startDate = startOfDay(subDays(endDate, 6));
//     } else if (range === '90d') {
//         startDate = startOfDay(subDays(endDate, 89));
//     } else if (range === 'all') {
//         startDate = new Date('2000-01-01'); // A date far in the past
//     } else { // Default to 30d
//         startDate = startOfDay(subDays(endDate, 29));
//     }

//     // --- 1. Fetch all content for this creator ---
//     const [videos, bundles] = await Promise.all([
//         Video.find({ creator: creatorId }).lean(),
//         Bundle.find({ creator: creatorId }).lean()
//     ]);
    
//     const allProductIds = [
//         ...videos.map(v => v._id),
//         ...bundles.map(b => b._id)
//     ];

//     const videoIds = videos.map(v => v._id);

//     // --- 2. Run all aggregations in parallel ---
//     const [salesData, viewsData, transactionList] = await Promise.all([
//         // Aggregate sales data for charts and stats
//         Transaction.aggregate([
//             { $match: { creator: creatorId, status: 'successful', createdAt: { $gte: startDate, $lte: endDate } } },
//             { $group: {
//                 _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
//                 totalEarningsKobo: { $sum: '$creatorEarningsKobo' },
//                 salesCount: { $sum: 1 }
//             }},
//             { $sort: { _id: 1 } }
//         ]),
       
//         VideoViewAggregate.aggregate([
//             { $match: { 
//                 video: { $in: videoIds },
//                 viewCounted: true, 
//                 viewCountedAt: { $gte: startDate, $lte: endDate } 
//             } },
//             { $group: {
//                 _id: { $dateToString: { format: "%Y-%m-%d", date: "$viewCountedAt" } },
//                 views: { $sum: 1 } // The field is named 'views'
//             }},
//             { $sort: { _id: 1 } }
//         ]),
        

//         // Get recent transactions for the list
//         Transaction.find({ creator: creatorId, status: 'successful', createdAt: { $gte: startDate, $lte: endDate } })
//             .sort({ createdAt: -1 })
//             .limit(10)
//             .populate('product', 'title')
//             .lean()
//     ]);

//     // --- 3. Process and combine data ---
//     let totalEarningsKobo = 0;
//     let totalSales = 0;
//     const salesMap = new Map(salesData.map(item => [item._id, item]));
//     salesData.forEach(item => {
//         totalEarningsKobo += item.totalEarningsKobo;
//         totalSales += item.salesCount;
//     });

//     let totalViews = 0;
//     const viewsMap = new Map(viewsData.map(item => [item._id, item]));
//     viewsData.forEach(item => { totalViews += item.views });

//     // Combine chart data
//     const allDates = new Set([...salesMap.keys(), ...viewsMap.keys()]);
//     const chartData = Array.from(allDates).sort().map(date => ({
//         date,
//         earnings: (salesMap.get(date)?.totalEarningsKobo || 0) / 100,
//         sales: salesMap.get(date)?.salesCount || 0,
//         views: viewsMap.get(date)?.views || 0,
//     }));

//     // Calculate top performing content
//     const contentWithStats = [...videos, ...bundles].map(item => {
//         const type = item.videos ? 'Bundle' : 'Video'; // Check if it's a bundle
//         return {
//             _id: item._id,
//             title: item.title,
//             type: type,
//             earnings: (item.totalSales * (item.priceKobo * 0.85)) / 100, // Approximate earnings
//             sales: item.totalSales || 0,
//             views: item.totalViews || 0,
//             conversionRate: (item.totalViews > 0) ? ((item.totalSales / item.totalViews) * 100).toFixed(1) : 0,
//         };
//     }).sort((a, b) => b.earnings - a.earnings); // Sort by earnings

//     // --- 4. Assemble the final response ---
//     res.status(200).json({
//         stats: {
//             totalEarningsKobo,
//             totalSales,
//             totalViews,
//             conversionRate: (totalViews > 0) ? ((totalSales / totalViews) * 100).toFixed(1) : 0,
//             productCount: allProductIds.length
//         },
//         chartData,
//         topContent: contentWithStats.slice(0, 10), // Top 10 products
//         recentTransactions: transactionList,
//     });
// });

// const getCreatorProfile = asyncHandler(async (req, res) => {
//     const creator = await User.findById(req.user.id)
//         .select('userName email firstName lastName avatarUrl bio websiteUrl twitterUrl youtubeUrl payoutBankName payoutAccountNumber payoutAccountName');
    
//     if (creator) {
//         res.json(creator);
//     } else {
//         res.status(404);
//         throw new Error('Creator profile not found');
//     }
// });



// /**
//  * @desc    Get a public creator profile and their videos
//  * @route   GET /api/v1/creators/:username
//  * @access  Public
//  */
// const getPublicCreatorProfile = asyncHandler(async (req, res) => {
//     // Find the creator by their username
//     const creator = await User.findOne({ 
//         userName: req.params.username, 
//         role: 'creator' 
//     }).select('firstName lastName userName avatarUrl bio websiteUrl twitterUrl avatarUrl youtubeUrl'); // Only select public fields

//     if (!creator) {
//         res.status(404);
//         throw new Error('Creator not found');
//     }

//     // Fetch public content (videos and bundles)
//     const [videos, bundles] = await Promise.all([
//         Video.find({ creator: creator._id, isActive: true }).sort({ createdAt: -1 }),
//         Bundle.find({ creator: creator._id, isActive: true }).sort({ createdAt: -1 })
//     ]);

//     const allContent = [...videos, ...bundles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

//     res.status(200).json({ creator, content: allContent });
// });

// const updateCreatorProfile = asyncHandler(async (req, res) => {
//     const { 
//         firstName, lastName, userName, bio, websiteUrl,
//         twitterUrl, youtubeUrl, avatarUrl, payoutBankName,
//         payoutAccountNumber, payoutAccountName,
//     } = req.body;

//     const user = await User.findById(req.user.id);
//     if (!user) {
//         res.status(404); throw new Error('User not found');
//     }

//     const oldUsername = user.userName;
//     const newUsername = userName;

//     // --- NEW LOGIC FOR USERNAME CHANGE ---
//     if (newUsername && newUsername !== oldUsername) {
//         // Check if the new username is already taken by another user
//         const existingUser = await User.findOne({ userName: newUsername });
//         if (existingUser) {
//             res.status(400);
//             throw new Error('Username is already taken. Please choose another.');
//         }
//         user.userName = newUsername;
//     }

//      if (firstName !== undefined) user.firstName = firstName;
//     if (lastName !== undefined) user.lastName = lastName;
//     if (userName !== undefined) user.userName = userName;
//     if (bio !== undefined) user.bio = bio;
//     if (websiteUrl !== undefined) user.websiteUrl = websiteUrl;
//     if (twitterUrl !== undefined) user.twitterUrl = twitterUrl;
//     if (youtubeUrl !== undefined) user.youtubeUrl = youtubeUrl;
//     if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
//     if (payoutBankName !== undefined) user.payoutBankName = payoutBankName;
//     if (payoutAccountNumber !== undefined) user.payoutAccountNumber = payoutAccountNumber;
//     if (payoutAccountName !== undefined) user.payoutAccountName = payoutAccountName;

    
    

//     try {
//         const updatedCreator = await user.save();

//         // If username was changed successfully, save the old one to the history
//         if (newUsername && newUsername !== oldUsername) {
//             await UsernameHistory.create({
//                 username: oldUsername,
//                 user: user._id,
//             });
//         }
        
//         res.json(updatedCreator);

//     } catch (error) {
//         // This specifically handles potential race conditions on the unique username index
//         if (error.code === 11000) {
//             res.status(400);
//             throw new Error('Username is already taken. Please choose another.');
//         }
//         throw error; // Re-throw other errors
//     }
// });


// const getCreatorPayouts = asyncHandler(async (req, res) => {
//     const payouts = await Payout.find({ creator: req.user.id }).sort({ createdAt: -1 });
//     res.status(200).json(payouts);
// });


// const getCreatorTransactions = asyncHandler(async (req, res) => {
//     const transactions = await Transaction.find({ creator: req.user.id, status: 'successful' })
//         .populate('product', 'title')
//         .sort({ createdAt: -1 });
//     res.status(200).json(transactions);
// });

// const requestPayout = asyncHandler(async (req, res) => {
//     const { amountKobo } = req.body;
//     const creatorId = new mongoose.Types.ObjectId(req.user.id);

//     const settings = await Settings.findOne({ singleton: 'main_settings' });
//     const payoutMode = settings?.payoutType || 'manual';
//     const payoutProviderKey = settings?.payoutProvider || 'nomba'; // Default to Nomba

//     if (!amountKobo || amountKobo <= 0) {
//         res.status(400);
//         throw new Error('A valid payout amount is required.');
//     }

//     let creator = await User.findById(creatorId);
//     if (!creator || !creator.payoutBankName || !creator.payoutAccountNumber || !creator.payoutAccountName) {
//         res.status(400);
//         throw new Error('Please complete your bank details in your profile before requesting a payout.');
//     }

//     // --- !! THIS IS THE MISSING LOGIC THAT CAUSED THE ERROR !! ---
//     const payoutAggregation = await Payout.aggregate([
//         { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending'] } } },
//         { $group: { _id: null, total: { $sum: '$amountKobo' } } }
//     ]);
//     const revenueAggregation = await Transaction.aggregate([
//         { $match: { creator: creatorId, status: 'successful' } },
//         { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
//     ]);
//     const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
//     const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
//     const availableBalanceKobo = totalRevenueKobo - totalPayoutsKobo;

//     if (amountKobo > availableBalanceKobo) {
//         res.status(400);
//         throw new Error('Payout request exceeds your available balance.');
//     }
//     // --- !! END OF MISSING LOGIC !! ---

//     if (payoutMode === 'automatic') {
//         const payout = await Payout.create({
//             creator: creatorId,
//             amountKobo,
//             status: 'processing', // Initial status before transfer attempt
//             provider: payoutProviderKey,
//         });
        
//         try {
//             // Initiate the transfer using the full creator object
//             // The payoutService (and nombaAdapter) will handle the bank code lookup.
//             const transferResult = await payoutService.initiateTransfer(amountKobo, creator, payout._id.toString());
            
//             payout.providerRef = transferResult.reference || transferResult.transfer_code;
//             // Check for Nomba's success status
//             payout.status = (transferResult.status === 'SUCCESS' || transferResult.status === 'success' || transferResult.status === 'completed') ? 'completed' : 'processing';
            
//             await payout.save();
//             res.status(201).json(payout);

//         } catch (error) {
//             console.error(`Payout Failed for Payout ID ${payout._id}:`, error.message);
//             payout.status = 'failed';
//             payout.notes = `Transfer failed: ${error.message}`;
//             await payout.save();
            
//             res.status(400).json({ message: error.message || 'Payment provider transfer failed.' });
//         }
//     } else {
//         // Manual Payout Logic
//         const payout = await Payout.create({
//             creator: creatorId,
//             amountKobo,
//             status: 'pending',
//             provider: payoutProviderKey,
//         });
//         res.status(201).json(payout);
//     }
// });

// /**
//  * @desc    Handles requests for creator profiles, including redirects for old usernames
//  *  * @route   GET /api/v1/creators/:username
//  * @access  Public
//  */
// const profileRedirect = asyncHandler(async (req, res, next) => {
//     const { username } = req.params;

//     // 1. First, try to find an active user with this username
//     const user = await User.findOne({ userName: username });
//     if (user) {
//         // Username is current, proceed to the normal profile function
//         return getPublicCreatorProfile(req, res, next);
//     }

//     // 2. If not found, check the history for an old username
//     const history = await UsernameHistory.findOne({ username: username }).populate('user', 'userName');
//     if (history && history.user) {
//         // Old username found, perform a permanent redirect to the new URL
//         return res.redirect(301, `/${history.user.userName}`);
//     }

//     // 3. If not found in users or history, it's a 404
//     res.status(404);
//     throw new Error('Creator not found');
// });


// module.exports = {
//     getCreatorDashboard,
//     getCreatorProfile,
//     updateCreatorProfile,
//     requestPayout,
//     getCreatorPayouts,
//     getCreatorTransactions,
//     getPublicCreatorProfile,
//     getCreatorAnalytics,
//     profileRedirect, 
// };


const asyncHandler = require('express-async-handler');
const mongoose = require('mongoose');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const Payout = require('../models/Payout');
const User = require('../models/User');
const UsernameHistory = require('../models/UsernameHistory');
const Settings = require('../models/Settings');
const payoutService = require('../services/payoutService');
const { startOfDay, subDays } = require('date-fns');

const Bundle = require('../models/Bundle');
const VideoViewAggregate = require('../models/VideoViewAggregate')

const getCreatorDashboard = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);
    const revenueAggregation = await Transaction.aggregate([
        { $match: { creator: creatorId, status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
    ]);
    const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
    
    // --- FIX: Added 'successful' to the list of statuses that count as "Paid/Pending" ---
    const payoutAggregation = await Payout.aggregate([
        { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending', 'successful'] } } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    // -----------------------------------------------------------------------------------

    const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
    const totalSales = await Transaction.countDocuments({ creator: creatorId, status: 'successful' });
    const monetizedVideosCount = await Video.countDocuments({ creator: creatorId });
    const recentVideos = await Video.find({ creator: creatorId }).sort({ createdAt: -1 }).limit(5);

    res.status(200).json({
        totalRevenueKobo,
        totalPayoutsKobo,
        availableBalanceKobo: totalRevenueKobo - totalPayoutsKobo,
        totalSales,
        monetizedVideosCount,
        recentVideos,
    });
});

/**
 * @desc    Get comprehensive analytics for a creator.
 * @route   GET /api/creator/analytics
 * @access  Private (Creator)
 */
const getCreatorAnalytics = asyncHandler(async (req, res) => {
    const creatorId = new mongoose.Types.ObjectId(req.user.id);
    const range = req.query.range || '30d'; // Default to 30 days

    let startDate;
    const endDate = new Date();

    if (range === '7d') {
        startDate = startOfDay(subDays(endDate, 6));
    } else if (range === '90d') {
        startDate = startOfDay(subDays(endDate, 89));
    } else if (range === 'all') {
        startDate = new Date('2000-01-01'); // A date far in the past
    } else { // Default to 30d
        startDate = startOfDay(subDays(endDate, 29));
    }

    // --- 1. Fetch all content for this creator ---
    const [videos, bundles] = await Promise.all([
        Video.find({ creator: creatorId }).lean(),
        Bundle.find({ creator: creatorId }).lean()
    ]);
    
    const allProductIds = [
        ...videos.map(v => v._id),
        ...bundles.map(b => b._id)
    ];

    const videoIds = videos.map(v => v._id);

    // --- 2. Run all aggregations in parallel ---
    const [salesData, viewsData, transactionList] = await Promise.all([
        // Aggregate sales data for charts and stats
        Transaction.aggregate([
            { $match: { creator: creatorId, status: 'successful', createdAt: { $gte: startDate, $lte: endDate } } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                totalEarningsKobo: { $sum: '$creatorEarningsKobo' },
                salesCount: { $sum: 1 }
            }},
            { $sort: { _id: 1 } }
        ]),
       
        VideoViewAggregate.aggregate([
            { $match: { 
                video: { $in: videoIds },
                viewCounted: true, 
                viewCountedAt: { $gte: startDate, $lte: endDate } 
            } },
            { $group: {
                _id: { $dateToString: { format: "%Y-%m-%d", date: "$viewCountedAt" } },
                views: { $sum: 1 } // The field is named 'views'
            }},
            { $sort: { _id: 1 } }
        ]),
        

        // Get recent transactions for the list
        Transaction.find({ creator: creatorId, status: 'successful', createdAt: { $gte: startDate, $lte: endDate } })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('product', 'title')
            .lean()
    ]);

    // --- 3. Process and combine data ---
    let totalEarningsKobo = 0;
    let totalSales = 0;
    const salesMap = new Map(salesData.map(item => [item._id, item]));
    salesData.forEach(item => {
        totalEarningsKobo += item.totalEarningsKobo;
        totalSales += item.salesCount;
    });

    let totalViews = 0;
    const viewsMap = new Map(viewsData.map(item => [item._id, item]));
    viewsData.forEach(item => { totalViews += item.views });

    // Combine chart data
    const allDates = new Set([...salesMap.keys(), ...viewsMap.keys()]);
    const chartData = Array.from(allDates).sort().map(date => ({
        date,
        earnings: (salesMap.get(date)?.totalEarningsKobo || 0) / 100,
        sales: salesMap.get(date)?.salesCount || 0,
        views: viewsMap.get(date)?.views || 0,
    }));

    // Calculate top performing content
    const contentWithStats = [...videos, ...bundles].map(item => {
        const type = item.videos ? 'Bundle' : 'Video'; // Check if it's a bundle
        return {
            _id: item._id,
            title: item.title,
            type: type,
            earnings: (item.totalSales * (item.priceKobo * 0.85)) / 100, // Approximate earnings
            sales: item.totalSales || 0,
            views: item.totalViews || 0,
            conversionRate: (item.totalViews > 0) ? ((item.totalSales / item.totalViews) * 100).toFixed(1) : 0,
        };
    }).sort((a, b) => b.earnings - a.earnings); // Sort by earnings

    // --- 4. Assemble the final response ---
    res.status(200).json({
        stats: {
            totalEarningsKobo,
            totalSales,
            totalViews,
            conversionRate: (totalViews > 0) ? ((totalSales / totalViews) * 100).toFixed(1) : 0,
            productCount: allProductIds.length
        },
        chartData,
        topContent: contentWithStats.slice(0, 10), // Top 10 products
        recentTransactions: transactionList,
    });
});

const getCreatorProfile = asyncHandler(async (req, res) => {
    const creator = await User.findById(req.user.id)
        .select('userName email firstName lastName avatarUrl bio websiteUrl twitterUrl youtubeUrl payoutBankName payoutAccountNumber payoutAccountName');
    
    if (creator) {
        res.json(creator);
    } else {
        res.status(404);
        throw new Error('Creator profile not found');
    }
});



/**
 * @desc    Get a public creator profile and their videos
 * @route   GET /api/v1/creators/:username
 * @access  Public
 */
const getPublicCreatorProfile = asyncHandler(async (req, res) => {
    // Find the creator by their username
    const creator = await User.findOne({ 
        userName: req.params.username, 
        role: 'creator' 
    }).select('firstName lastName userName avatarUrl bio websiteUrl twitterUrl avatarUrl youtubeUrl'); // Only select public fields

    if (!creator) {
        res.status(404);
        throw new Error('Creator not found');
    }

    // Fetch public content (videos and bundles)
    const [videos, bundles] = await Promise.all([
        Video.find({ creator: creator._id, isActive: true }).sort({ createdAt: -1 }),
        Bundle.find({ creator: creator._id, isActive: true }).sort({ createdAt: -1 })
    ]);

    const allContent = [...videos, ...bundles].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.status(200).json({ creator, content: allContent });
});

const updateCreatorProfile = asyncHandler(async (req, res) => {
    const { 
        firstName, lastName, userName, bio, websiteUrl,
        twitterUrl, youtubeUrl, avatarUrl, payoutBankName,
        payoutAccountNumber, payoutAccountName,
    } = req.body;

    const user = await User.findById(req.user.id);
    if (!user) {
        res.status(404); throw new Error('User not found');
    }

    const oldUsername = user.userName;
    const newUsername = userName;

    // --- NEW LOGIC FOR USERNAME CHANGE ---
    if (newUsername && newUsername !== oldUsername) {
        // Check if the new username is already taken by another user
        const existingUser = await User.findOne({ userName: newUsername });
        if (existingUser) {
            res.status(400);
            throw new Error('Username is already taken. Please choose another.');
        }
        user.userName = newUsername;
    }

     if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (userName !== undefined) user.userName = userName;
    if (bio !== undefined) user.bio = bio;
    if (websiteUrl !== undefined) user.websiteUrl = websiteUrl;
    if (twitterUrl !== undefined) user.twitterUrl = twitterUrl;
    if (youtubeUrl !== undefined) user.youtubeUrl = youtubeUrl;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    if (payoutBankName !== undefined) user.payoutBankName = payoutBankName;
    if (payoutAccountNumber !== undefined) user.payoutAccountNumber = payoutAccountNumber;
    if (payoutAccountName !== undefined) user.payoutAccountName = payoutAccountName;

    
    

    try {
        const updatedCreator = await user.save();

        // If username was changed successfully, save the old one to the history
        if (newUsername && newUsername !== oldUsername) {
            await UsernameHistory.create({
                username: oldUsername,
                user: user._id,
            });
        }
        
        res.json(updatedCreator);

    } catch (error) {
        // This specifically handles potential race conditions on the unique username index
        if (error.code === 11000) {
            res.status(400);
            throw new Error('Username is already taken. Please choose another.');
        }
        throw error; // Re-throw other errors
    }
});


const getCreatorPayouts = asyncHandler(async (req, res) => {
    const payouts = await Payout.find({ creator: req.user.id }).sort({ createdAt: -1 });
    res.status(200).json(payouts);
});


const getCreatorTransactions = asyncHandler(async (req, res) => {
    const transactions = await Transaction.find({ creator: req.user.id, status: 'successful' })
        .populate('product', 'title')
        .sort({ createdAt: -1 });
    res.status(200).json(transactions);
});

const requestPayout = asyncHandler(async (req, res) => {
    const { amountKobo } = req.body;
    const creatorId = new mongoose.Types.ObjectId(req.user.id);

    const settings = await Settings.findOne({ singleton: 'main_settings' });
    const payoutMode = settings?.payoutType || 'manual';
    const payoutProviderKey = settings?.payoutProvider || 'nomba'; // Default to Nomba

    if (!amountKobo || amountKobo <= 0) {
        res.status(400);
        throw new Error('A valid payout amount is required.');
    }

    let creator = await User.findById(creatorId);
    if (!creator || !creator.payoutBankName || !creator.payoutAccountNumber || !creator.payoutAccountName) {
        res.status(400);
        throw new Error('Please complete your bank details in your profile before requesting a payout.');
    }

    // --- FIX: Added 'successful' to this check so we don't overdraw ---
    const payoutAggregation = await Payout.aggregate([
        { $match: { creator: creatorId, status: { $in: ['completed', 'processing', 'pending', 'successful'] } } },
        { $group: { _id: null, total: { $sum: '$amountKobo' } } }
    ]);
    // ----------------------------------------------------------------

    const revenueAggregation = await Transaction.aggregate([
        { $match: { creator: creatorId, status: 'successful' } },
        { $group: { _id: null, total: { $sum: '$creatorEarningsKobo' } } }
    ]);
    const totalPayoutsKobo = payoutAggregation.length > 0 ? payoutAggregation[0].total : 0;
    const totalRevenueKobo = revenueAggregation.length > 0 ? revenueAggregation[0].total : 0;
    const availableBalanceKobo = totalRevenueKobo - totalPayoutsKobo;

    if (amountKobo > availableBalanceKobo) {
        res.status(400);
        throw new Error('Payout request exceeds your available balance.');
    }

    if (payoutMode === 'automatic') {
        const payout = await Payout.create({
            creator: creatorId,
            amountKobo,
            status: 'processing', // Initial status before transfer attempt
            provider: payoutProviderKey,
        });
        
        try {
            // Initiate the transfer using the full creator object
            const transferResult = await payoutService.initiateTransfer(amountKobo, creator, payout._id.toString());
            
            payout.providerRef = transferResult.reference || transferResult.transfer_code;
            
            // --- FIX: Standardized success check to use 'successful' instead of 'completed' ---
            const isSuccess = 
                transferResult.status === 'SUCCESS' || 
                transferResult.status === 'success' || 
                transferResult.status === 'completed' || 
                transferResult.status === 'successful';

            payout.status = isSuccess ? 'successful' : 'processing';
            // ---------------------------------------------------------------------------------
            
            await payout.save();
            res.status(201).json(payout);

        } catch (error) {
            console.error(`Payout Failed for Payout ID ${payout._id}:`, error.message);
            payout.status = 'failed';
            payout.notes = `Transfer failed: ${error.message}`;
            await payout.save();
            
            res.status(400).json({ message: error.message || 'Payment provider transfer failed.' });
        }
    } else {
        // Manual Payout Logic
        const payout = await Payout.create({
            creator: creatorId,
            amountKobo,
            status: 'pending',
            provider: payoutProviderKey,
        });
        res.status(201).json(payout);
    }
});

/**
 * @desc    Handles requests for creator profiles, including redirects for old usernames
 * * @route   GET /api/v1/creators/:username
 * @access  Public
 */
const profileRedirect = asyncHandler(async (req, res, next) => {
    const { username } = req.params;

    // 1. First, try to find an active user with this username
    const user = await User.findOne({ userName: username });
    if (user) {
        // Username is current, proceed to the normal profile function
        return getPublicCreatorProfile(req, res, next);
    }

    // 2. If not found, check the history for an old username
    const history = await UsernameHistory.findOne({ username: username }).populate('user', 'userName');
    if (history && history.user) {
        // Old username found, perform a permanent redirect to the new URL
        return res.redirect(301, `/${history.user.userName}`);
    }

    // 3. If not found in users or history, it's a 404
    res.status(404);
    throw new Error('Creator not found');
});


module.exports = {
    getCreatorDashboard,
    getCreatorProfile,
    updateCreatorProfile,
    requestPayout,
    getCreatorPayouts,
    getCreatorTransactions,
    getPublicCreatorProfile,
    getCreatorAnalytics,
    profileRedirect,
};