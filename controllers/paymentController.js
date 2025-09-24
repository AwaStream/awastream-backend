

// const asyncHandler = require('express-async-handler');
// const Video = require('../models/Video');
// const Transaction = require('../models/Transaction');
// const { initializePayment, verifyPayment, handlePaystackWebhook, handleStripeWebhook } = require('../services/paymentGateway');
// const crypto = require('crypto');

// const initializeVideoPayment = asyncHandler(async (req, res) => {
//     const { videoId } = req.body;
//     const user = req.user;
//     const video = await Video.findById(videoId).populate('creator');

//     if (!video) {
//         res.status(404);
//         throw new Error('Video not found');
//     }

//     const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
//     const activeProvider = process.env.ACTIVE_PAYMENT_PROVIDER || 'paystack';

//     await Transaction.create({
//         viewer: user._id,
//         video: video._id,
//         creator: video.creator._id,
//         amountKobo: video.priceKobo,
//         status: 'pending',
//         internalRef: internalRef,
//         paymentProvider: activeProvider,
//     });
    
//     // Pass video details to the gateway for a better checkout experience (e.g., for Stripe)
//     const videoDetails = { title: video.title, slug: video.shareableSlug };
//     const paymentData = await initializePayment(user.email, video.priceKobo, internalRef, videoDetails);

//     res.status(200).json({ authorizationUrl: paymentData.authorization_url });
// });

// const verifyViewerPayment = asyncHandler(async (req, res) => {
//     const { provider, reference, sessionId } = req.body;
//     let verification;

//     // The gateway determines which provider to use
//     if (provider === 'paystack' && reference) {
//         verification = await verifyPayment(reference); 
//     } else if (provider === 'stripe' && sessionId) {
//         verification = await verifyPayment(sessionId);
//     } else {
//         res.status(400);
//         throw new Error('Invalid payment verification request.');
//     }
    
//     // Check the standardized status from our gateway
//     if (verification.status === 'success') {
//         res.status(200).json({ status: 'successful' });
//     } else {
//         res.status(400).json({ status: 'failed', message: 'Payment not confirmed by provider.' });
//     }
// });

// const handlePaystackWebhook = asyncHandler(async (req, res) => {
//     await handlePaystackWebhook(req); // Call gateway function
//     res.sendStatus(200);
// });

// const handleStripeWebhook = asyncHandler(async (req, res) => {
//     await handleStripeWebhook(req); // Call gateway function
//     res.sendStatus(200);
// });

// module.exports = {
//     initializeVideoPayment,
//     verifyViewerPayment,
//     handlePaystackWebhook,
//     handleStripeWebhook,
// };





const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
// Import the gateway functions and rename them to avoid conflicts
const { 
    initializePayment, 
    verifyPayment, 
    handlePaystackWebhook: handlePaystackWebhookFromGateway, 
    handleStripeWebhook: handleStripeWebhookFromGateway 
} = require('../services/paymentGateway');

const initializeVideoPayment = asyncHandler(async (req, res) => {
    const { videoId } = req.body;
    const user = req.user;
    const video = await Video.findById(videoId).populate('creator');

    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }

    const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const activeProvider = process.env.ACTIVE_PAYMENT_PROVIDER || 'paystack';

    await Transaction.create({
        viewer: user._id,
        video: video._id,
        creator: video.creator._id,
        amountKobo: video.priceKobo,
        status: 'pending',
        internalRef: internalRef,
        paymentProvider: activeProvider,
    });
    
    const videoDetails = { title: video.title, slug: video.shareableSlug };
    const paymentData = await initializePayment(user.email, video.priceKobo, internalRef, videoDetails);

    res.status(200).json({ authorizationUrl: paymentData.authorization_url });
});

const verifyViewerPayment = asyncHandler(async (req, res) => {
    const { provider, reference, sessionId } = req.body;
    let verification;

    if (provider === 'paystack' && reference) {
        verification = await verifyPayment(reference); 
    } else if (provider === 'stripe' && sessionId) {
        verification = await verifyPayment(sessionId);
    } else {
        res.status(400);
        throw new Error('Invalid payment verification request.');
    }
    
    if (verification.status === 'success') {
        res.status(200).json({ status: 'successful' });
    } else {
        res.status(400).json({ status: 'failed', message: 'Payment not confirmed by provider.' });
    }
});

const handlePaystackWebhook = asyncHandler(async (req, res) => {
    // Call the renamed function from the gateway
    await handlePaystackWebhookFromGateway(req); 
    res.sendStatus(200);
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
    // Call the renamed function from the gateway
    await handleStripeWebhookFromGateway(req); 
    res.sendStatus(200);
});

module.exports = {
    initializeVideoPayment,
    verifyViewerPayment,
    handlePaystackWebhook,
    handleStripeWebhook,
};