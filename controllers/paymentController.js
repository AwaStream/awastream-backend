const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const { initializePayment, verifyPayment } = require('../services/paymentService');
const crypto = require('crypto');

// @desc    Initialize a payment for a video
// @route   POST /api/payments/initialize
// @access  Private

const initializeVideoPayment = asyncHandler(async (req, res) => {
    console.log('--- [PaymentController] ENTERED initializeVideoPayment ---');
    
    try {
        const { videoId } = req.body;
        const user = req.user;

        console.log(`[PaymentController] 1. Received videoId from frontend: ${videoId}`);
        console.log(`[PaymentController] 2. Authenticated user ID: ${user._id}`);

        if (!videoId) {
            console.error('[PaymentController] FAILED at step 1: videoId is missing from request body.');
            res.status(400);
            throw new Error('videoId is required.');
        }

        const video = await Video.findById(videoId).populate('creator');
        
        if (!video) {
            console.error(`[PaymentController] FAILED at step 3: Video not found in database for ID: ${videoId}`);
            res.status(404);
            throw new Error('Video not found');
        }
        console.log(`[PaymentController] 3. Found video in database: "${video.title}" created by ${video.creator.userName}`);

        const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

        await Transaction.create({
            viewer: user._id,
            video: video._id,
            creator: video.creator._id, 
            amountKobo: video.priceKobo,
            status: 'pending',
            internalRef: internalRef,
        });
        console.log(`[PaymentController] 4. Created pending transaction with ref: ${internalRef}`);
        
        console.log(`[PaymentController] 5. Calling Paystack service for user ${user.email} and amount ${video.priceKobo}...`);
        const paymentData = await initializePayment(user.email, video.priceKobo, internalRef);
        console.log('[PaymentController] 6. Received authorization URL from Paystack.');

        res.status(200).json({ authorizationUrl: paymentData.authorization_url });
        console.log('--- [PaymentController] EXITED initializeVideoPayment successfully ---');

    } catch (error) {
        console.error('--- [PaymentController] CRASH in initializeVideoPayment ---');
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        throw error;
    }
});


// const initializeVideoPayment = asyncHandler(async (req, res) => {
//     const { videoId } = req.body;
//     const user = req.user;

//      const video = await Video.findById(videoId).populate('creator');
//     if (!video) {
//         res.status(404);
//         throw new Error('Video not found');
//     }
//     const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

//     // Create a pending transaction record
//     await Transaction.create({
//         viewer: user._id,
//         video: video._id,
//         creator: video.creator._id,
//         amountKobo: video.priceKobo,
//         status: 'pending',
//         internalRef: internalRef,
//     });
    
//     // Call payment service to get the payment URL
//     const paymentData = await initializePayment(user.email, video.priceKobo, internalRef);

//     res.status(200).json({ authorizationUrl: paymentData.authorization_url });
// });


// @desc    Handle incoming webhook from payment provider
// @route   POST /api/payments/webhook
// @access  Public (Secured by signature verification)
const handlePaymentWebhook = asyncHandler(async (req, res) => {
    // IMPORTANT: In production, you must verify the webhook signature
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
        return res.sendStatus(401);
    }
    
    const { event, data } = req.body;

    if (event === 'charge.success') {
        const transaction = await Transaction.findOne({ internalRef: data.reference });

        if (transaction && transaction.status === 'pending') {
            const verification = await verifyPayment(data.reference);

            if (verification.status === 'success') {
                const grossAmountKobo = verification.amount;

                const commissionRate = 0.15;
                const commissionKobo = Math.round(grossAmountKobo * commissionRate);
                const creatorEarningsKobo = grossAmountKobo - commissionKobo;

                transaction.status = 'successful';
                transaction.providerRef = verification.id.toString();
                transaction.commissionKobo = commissionKobo;
                transaction.creatorEarningsKobo = creatorEarningsKobo;
                
                await transaction.save();
                
                // TODO: Trigger notifications, etc.
                console.log(`Transaction ${transaction.internalRef} successfully processed with commission.`);
            }
        }
    }
    
    res.sendStatus(200);
});


/**
 * @desc    Verify a payment from the frontend after redirect
 * @route   POST /api/payments/verify
 * @access  Private
 */
const verifyViewerPayment = asyncHandler(async (req, res) => {
    const { reference } = req.body;
    
    // Find our internal transaction record and populate the video's slug
    const transaction = await Transaction.findOne({ internalRef: reference, viewer: req.user.id })
        .populate('video', 'shareableSlug');

    if (!transaction) {
        res.status(404);
        throw new Error('Transaction not found or does not belong to user.');
    }
    
    // Even if our webhook has already processed it, we can still return success.
    if (transaction.status === 'successful') {
        return res.status(200).json({ 
            status: 'successful', 
            videoSlug: transaction.video.shareableSlug 
        });
    }

    // If webhook hasn't run yet, we can optionally re-verify with Paystack here
    const verification = await verifyPayment(reference);
    
    if (verification.status === 'success') {
         // Update our transaction if needed (though webhook is the primary method)
        if (transaction.status === 'pending') {
            transaction.status = 'successful';
            // You can also calculate commission here as a fallback
            await transaction.save();
        }
        res.status(200).json({ 
            status: 'successful', 
            videoSlug: transaction.video.shareableSlug 
        });
    } else {
        res.status(400).json({ status: 'failed', message: 'Payment not confirmed by provider.' });
    }
});

module.exports = {
    initializeVideoPayment,
    handlePaymentWebhook,
    verifyViewerPayment,
};