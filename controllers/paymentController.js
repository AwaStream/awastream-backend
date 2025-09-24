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

/**
 * @desc    Verify a payment from the frontend after a redirect.
 * @route   POST /api/payments/verify
 * @access  Private
 */
const verifyViewerPayment = asyncHandler(async (req, res) => {
    const { provider, reference, sessionId, slug } = req.body;
    const user = req.user;

    if (!slug) {
        res.status(400);
        throw new Error("Video slug is required for verification.");
    }
    
    const video = await Video.findOne({ shareableSlug: slug });
    if (!video) {
        res.status(404);
        throw new Error("Video associated with this payment not found.");
    }

    let transaction;
    let verification;

    // --- THIS IS THE CORRECTED LOGIC ---
    if (provider === 'paystack' && reference) {
        // For Paystack, we can find our transaction first using the reference
        transaction = await Transaction.findOne({ internalRef: reference, viewer: user.id, video: video.id });
        if (transaction) {
            verification = await verifyPayment(reference); // verifyPayment is from the gateway
        }
    } else if (provider === 'stripe' && sessionId) {
        // For Stripe, we first verify the session to get our internal reference
        verification = await verifyPayment(sessionId);
        if (verification && verification.reference) {
            transaction = await Transaction.findOne({ internalRef: verification.reference, viewer: user.id, video: video.id });
        }
    } else {
        res.status(400);
        throw new Error('A valid payment provider and reference/sessionId are required.');
    }
    // --- END OF CORRECTED LOGIC ---

    if (!transaction) {
        res.status(404);
        throw new Error('Matching transaction not found. Verification failed.');
    }

    // If webhook has already updated the status, we can succeed early
    if (transaction.status === 'successful') {
        return res.status(200).json({ 
            status: 'successful', 
            videoSlug: video.shareableSlug 
        });
    }
    
    // If still pending, verify directly with the payment gateway as a fallback
    if (verification && verification.status === 'success') {
        // Update our transaction status as a backup to the webhook
        transaction.status = 'successful';
        await transaction.save();

        res.status(200).json({ 
            status: 'successful', 
            videoSlug: video.shareableSlug 
        });
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