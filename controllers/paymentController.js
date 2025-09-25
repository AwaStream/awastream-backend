const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const { 
    initializePayment, 
    verifyPayment, 
    handlePaystackWebhook: handlePaystackWebhookFromGateway, 
    handleStripeWebhook: handleStripeWebhookFromGateway 
} = require('../services/paymentGateway');
const { handleTransferWebhook } = require('../services/payoutService'); // Import transfer webhook handler

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
 * @desc     Verify a payment from the frontend after a redirect.
 * @route    POST /api/payments/verify
 * @access   Private
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

    if (provider === 'paystack' && reference) {
        transaction = await Transaction.findOne({ internalRef: reference, viewer: user.id, video: video.id });
        if (transaction) {
            verification = await verifyPayment(reference);
        }
    } else if (provider === 'stripe' && sessionId) {
        verification = await verifyPayment(sessionId);
        if (verification && verification.reference) {
            transaction = await Transaction.findOne({ internalRef: verification.reference, viewer: user.id, video: video.id });
        }
    } else {
        res.status(400);
        throw new Error('A valid payment provider and reference/sessionId are required.');
    }

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
    
    console.log('--- VERIFYING PAYMENT VIA CALLBACK ---');
    console.log('Verification data from Paystack:', verification); // Log the whole object

    // --- FIX: Added calculation logic to the fallback ---
    // If still pending, verify directly and update the transaction fully.
    if (verification && verification.status === 'success') {
        // Calculate commission and earnings, just like the webhook
        const grossAmountKobo = verification.amount;
        console.log('Gross amount received:', grossAmountKobo, 'Type:', typeof grossAmountKobo);
        const commissionRate = 0.15; // 15%
        const commissionKobo = Math.round(grossAmountKobo * commissionRate);
        const creatorEarningsKobo = grossAmountKobo - commissionKobo;

        // Update our transaction with all the necessary details
        transaction.status = 'successful';
        transaction.providerRef = verification.id.toString();
        transaction.commissionKobo = commissionKobo;
        transaction.creatorEarningsKobo = creatorEarningsKobo;
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
    await handlePaystackWebhookFromGateway(req); 
    res.sendStatus(200);
});

const handleStripeWebhook = asyncHandler(async (req, res) => {
    await handleStripeWebhookFromGateway(req); 
    res.sendStatus(200);
});

// NEW FUNCTION
const handlePaystackTransferWebhook = asyncHandler(async (req, res) => {
    await handleTransferWebhook(req); 
    res.sendStatus(200);
});

module.exports = {
    initializeVideoPayment,
    verifyViewerPayment,
    handlePaystackWebhook,
    handleStripeWebhook,
    handlePaystackTransferWebhook, // EXPORT the new function
};