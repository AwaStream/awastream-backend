const Notification = require('../models/Notification');
const asyncHandler = require('express-async-handler');
const Video = require('../models/Video');
const Bundle = require('../models/Bundle');
const Transaction = require('../models/Transaction');
const crypto = require('crypto');
const { COMMISSION_RATE } = require('../config/constants');
const { 
    initializePayment: initializePaymentGateway, 
    verifyPayment, 
    handlePaystackWebhook: handlePaystackWebhookFromGateway, 
    handleStripeWebhook: handleStripeWebhookFromGateway 
} = require('../services/paymentGateway');
const { handleTransferWebhook } = require('../services/payoutService');

const initializePayment = asyncHandler(async (req, res) => {
    const { videoId, bundleId } = req.body;
    const user = req.user;

    let product;
    let productType;

      if (videoId) {
        product = await Video.findById(videoId).populate('creator');
        productType = 'Video';
    } else if (bundleId) {
        product = await Bundle.findById(bundleId).populate('creator');
        productType = 'Bundle';
    } else {
        res.status(400);
        throw new Error('Either videoId or bundleId is required to initialize payment.');
    }

     if (!product) {
        res.status(404);
        throw new Error(`${productType} not found`);
    }

    const internalRef = `AWAS-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const activeProvider = process.env.ACTIVE_PAYMENT_PROVIDER || 'paystack';

    await Transaction.create({
        user: user._id,
        product: product._id,
        productType: productType,
        creator: product.creator._id,
        amountKobo: product.priceKobo,
        status: 'pending',
        internalRef: internalRef,
        paymentProvider: activeProvider,
    });
    
    const productDetails = { title: product.title, slug: product.shareableSlug, productType }; // Pass productType for success URL
    const paymentData = await initializePaymentGateway(user.email, product.priceKobo, internalRef, productDetails); // Renamed to avoid clash

    res.status(200).json({ authorizationUrl: paymentData.authorization_url });

    });


/**
 * @desc     Verify a payment from the frontend after a redirect.
 * @route    POST /api/payments/verify
 * @access   Private
 */
const verifyViewerPayment = asyncHandler(async (req, res) => {
    const { provider, reference, sessionId, slug, productType: requestedProductType } = req.body;
    const user = req.user;

    if (!slug || !requestedProductType) {
        res.status(400);
        throw new Error("Product slug and productType are required for verification.");
    }
    
    // --- FIX 1: Find the product based on its type ---
    let product;
    if (requestedProductType === 'Video') {
        product = await Video.findOne({ shareableSlug: slug });
    } else if (requestedProductType === 'Bundle') {
        product = await Bundle.findOne({ shareableSlug: slug });
    }
    
    if (!product) {
        res.status(404);
        throw new Error("Product associated with this payment not found.");
    }

    let transaction;
    let verification;

    // --- FIX 2: Use the generic 'product' variable to find the transaction ---
    if (provider === 'paystack' && reference) {
        transaction = await Transaction.findOne({
            internalRef: reference,
            user: user.id,
            product: product.id // Use generic product ID
        });
        if (transaction) {
            verification = await verifyPayment(reference);
        }
    } else if (provider === 'stripe' && sessionId) {
        verification = await verifyPayment(sessionId);
        if (verification && verification.reference) {
            transaction = await Transaction.findOne({
                internalRef: verification.reference,
                user: user.id,
                product: product.id // Use generic product ID
            });
        }
    } else {
        res.status(400);
        throw new Error('A valid payment provider and reference/sessionId are required.');
    }

    if (!transaction) {
        res.status(404);
        throw new Error('Matching transaction not found. Verification failed.');
    }

    if (transaction.status === 'successful') {
        return res.status(200).json({ 
            status: 'successful', 
            productSlug: product.shareableSlug, // Use generic slug name
            productType: requestedProductType,
        });
    }
    
    if (verification && verification.status === 'success') {
        const grossAmountKobo = verification.amount;
        const commissionKobo = Math.round(grossAmountKobo * COMMISSION_RATE);
        const creatorEarningsKobo = grossAmountKobo - commissionKobo;

        transaction.status = 'successful';
        transaction.providerRef = verification.id.toString();
        transaction.commissionKobo = commissionKobo;
        transaction.creatorEarningsKobo = creatorEarningsKobo;
        await transaction.save();

        if (transaction.status === 'successful') {
        const productType = transaction.productType.toLowerCase(); // 'video' or 'bundle'
        await Notification.create({
            user: transaction.creator, // The creator gets the notification
            type: 'new_sale',
            message: `${req.user.firstName} purchased your ${productType}: "${product.title}"`,
            link: `/${productType}s/${product.shareableSlug}` // e.g., /videos/slug or /bundles/slug
        });
    }

        // --- FIX 3: Increment sales counter on the correct model ---
        if (transaction.productType === 'Video') {
            await Video.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
        } else if (transaction.productType === 'Bundle') {
            await Bundle.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
        }

        res.status(200).json({ 
            status: 'successful', 
            productSlug: product.shareableSlug, // Use generic slug name
            productType: requestedProductType,
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


const handlePaystackTransferWebhook = asyncHandler(async (req, res) => {
    await handleTransferWebhook(req); 
    res.sendStatus(200);
});

module.exports = {
    initializePayment,
    verifyViewerPayment,
    handlePaystackWebhook,
    handleStripeWebhook,
    handlePaystackTransferWebhook,
};