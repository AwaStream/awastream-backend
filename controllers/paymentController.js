const asyncHandler = require('express-async-handler');
const crypto = require('crypto');
const Video = require('../models/Video');
const Bundle = require('../models/Bundle');
const Transaction = require('../models/Transaction');
const Notification = require('../models/Notification');
const { COMMISSION_RATE } = require('../config/constants');
const { 
    initializePayment: initializePaymentGateway, 
    verifyPayment: verifyPaymentGateway, 
    getActiveIncomingProvider, // <-- Import new function
    getTransferAccount: getTransferAccountGateway,
    handlePaystackWebhook: handlePaystackWebhookFromGateway, 
    handleStripeWebhook: handleStripeWebhookFromGateway 
} = require('../services/paymentGateway');
const { handleTransferWebhook } = require('../services/payoutService');
const nombaAdapter = require('../services/providers/nombaAdapter');

/**
 * @desc     Initialize a payment for a video or bundle
 * @route    POST /api/payments/initialize
 * @access   Private
 */
const initializePayment = asyncHandler(async (req, res) => {
    const { videoId, bundleId } = req.body;
    const user = req.user;
    
    if (!user || !user.email) {
        res.status(401); 
        throw new Error('Authentication required, or user profile is missing email.');
    }

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
    
    // --- !! NEW LOGIC !! ---
    // 1. Get the active provider *and* its name from the DB settings
    const { providerKey } = await getActiveIncomingProvider();

    // 2. Create the transaction, saving the *correct* provider
    await Transaction.create({
        user: user._id,
        product: product._id,
        productType: productType,
        productTitle: product.title,
        creator: product.creator._id,
        amountKobo: product.priceKobo,
        status: 'pending',
        internalRef: internalRef,
        paymentProvider: providerKey, // <-- CRITICAL FIX: Saves 'nomba' or 'paystack'
    });
    
    // 3. Initialize payment
    const productDetails = { title: product.title, slug: product.shareableSlug, productType };
    const paymentData = await initializePaymentGateway(user.email, product.priceKobo, internalRef, productDetails);

    // Return both the URL and the reference
    res.status(200).json({ 
        authorizationUrl: paymentData.authorization_url, 
        reference: internalRef 
    });
});


/**
 * @desc     Verify a payment from the frontend after a redirect.
 * @route    POST /api/payments/verify
 * @access   Private
 */
const verifyViewerPayment = asyncHandler(async (req, res) => {
    // We only need the reference. We will get the provider from our DB.
    const { reference } = req.body; 
    const user = req.user;

    if (!reference) {
        res.status(400);
        throw new Error('Payment reference is required.');
    }

    // --- !! NEW LOGIC !! ---
    // 1. Find the transaction using the internal reference
    let transaction = await Transaction.findOne({
        internalRef: reference,
        user: user.id
    });

    if (!transaction) {
        res.status(404);
        throw new Error('Matching transaction not found. Verification failed.');
    }

    // Find the product associated with this transaction
    let product;
    if (transaction.productType === 'Video') {
        product = await Video.findById(transaction.product);
    } else if (transaction.productType === 'Bundle') {
        product = await Bundle.findById(transaction.product);
    }

    if (!product) {
        res.status(404);
        throw new Error("Product associated with this payment not found.");
    }

    if (transaction.status === 'successful') {
        return res.status(200).json({ 
            status: 'successful', 
            productSlug: product.shareableSlug,
            productType: transaction.productType,
        });
    }
    
    // 2. Get the provider from the transaction ITSELF
    const providerKey = transaction.paymentProvider; // e.g., 'nomba'

    // 3. Call the gateway's verify function, passing the specific provider key
    const verification = await verifyPaymentGateway(providerKey, reference);
    
    if (verification && verification.status === 'success') {
        const grossAmountKobo = verification.amount;
        const commissionKobo = Math.round(grossAmountKobo * COMMISSION_RATE);
        const creatorEarningsKobo = grossAmountKobo - commissionKobo;

        transaction.status = 'successful';
        transaction.providerRef = verification.id.toString(); // Nomba or Paystack's TX ID
        transaction.commissionKobo = commissionKobo;
        transaction.creatorEarningsKobo = creatorEarningsKobo;
        await transaction.save();

        // Create notification
        try {
            await Notification.create({
                user: transaction.creator, // The creator gets the notification
                type: 'new_sale',
                message: `${req.user.firstName} purchased your ${transaction.productType.toLowerCase()}: "${product.title}"`,
                link: `/${transaction.productType.toLowerCase()}s/${product.shareableSlug}`
            });
        } catch (notificationError) {
            console.error("Failed to create sale notification:", notificationError);
        }

        // Increment sales counter on the correct model
        if (transaction.productType === 'Video') {
            await Video.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
        } else if (transaction.productType === 'Bundle') {
            await Bundle.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
        }

        res.status(200).json({ 
            status: 'successful', 
            productSlug: product.shareableSlug,
            productType: transaction.productType,
        });
    } else {
        res.status(400).json({ status: 'failed', message: 'Payment not confirmed by provider.' });
    }
});

const getTransferPaymentDetails = asyncHandler(async (req, res) => {
    const { reference } = req.body;

    if (!reference) {
        res.status(400);
        throw new Error('Transaction reference is required');
    }

    // Find the transaction in our DB to make sure it's real
    const transaction = await Transaction.findOne({ 
        internalRef: reference, 
        user: req.user.id 
    });

    if (!transaction) {
        res.status(404);
        throw new Error('Transaction not found');
    }

    if (transaction.paymentProvider !== 'nomba') {
        res.status(400);
        throw new Error('This transaction is not a Nomba transaction.');
    }

    try {
        // Call the new adapter function
        const accountDetails = await getTransferAccountGateway(reference);
        res.status(200).json(accountDetails);
    } catch (error) {
        res.status(500);
        throw new Error(error.message || 'Failed to retrieve transfer details');
    }
});


// --- WEBHOOK HANDLERS (No changes needed) ---

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

// @desc    Handle Nomba Webhooks
// @route   POST /api/v1/payments/webhook/nomba
// @access  Public (Protected by Signature)
const handleNombaWebhook = asyncHandler(async (req, res) => {
    try {
        await nombaAdapter.handleWebhook(req);
        res.status(200).send('Webhook received');
    } catch (error) {
        console.error("Nomba Webhook Error:", error.message);
        // Always return 200 to Nomba so they don't keep retrying if it's just a logic error
        res.status(200).send('Webhook received with errors'); 
    }
});

module.exports = {
    initializePayment,
    verifyViewerPayment,
    getTransferPaymentDetails,
    handlePaystackWebhook,
    handleStripeWebhook,
    handleNombaWebhook,
    handlePaystackTransferWebhook,
};