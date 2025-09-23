const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Transaction = require('../models/Transaction');
const { initializePayment, verifyPayment } = require('../services/paymentService');
const crypto = require('crypto');

// @desc    Initialize a payment for a video
// @route   POST /api/payments/initialize
// @access  Private
const initializeVideoPayment = asyncHandler(async (req, res) => {
    const { videoId } = req.body;
    const user = req.user;

    const video = await Video.findById(videoId);
    if (!video) {
        res.status(404);
        throw new Error('Video not found');
    }

    const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Create a pending transaction record
    await Transaction.create({
        viewer: user._id,
        video: video._id,
        amountKobo: video.priceKobo,
        status: 'pending',
        internalRef: internalRef,
    });
    
    // Call payment service to get the payment URL
    const paymentData = await initializePayment(user.email, video.priceKobo, internalRef);

    res.status(200).json({ authorizationUrl: paymentData.authorization_url });
});


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
                const commissionKobo = Math.round(grossAmountKobo * 0.15);
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

module.exports = {
    initializeVideoPayment,
    handlePaymentWebhook,
};