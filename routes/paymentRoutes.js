const express = require('express');
const router = express.Router();
const { 
    initializeVideoPayment, 
    verifyViewerPayment,
    handlePaystackWebhook,
    handleStripeWebhook
} = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/initialize', authenticate, initializeVideoPayment);
router.post('/verify', authenticate, verifyViewerPayment);

// --- WEBHOOKS ---
// These are public but secured by signature verification within the adapters
router.post('/webhook/paystack', handlePaystackWebhook);
router.post('/webhook/stripe', express.raw({ type: 'application/json' }), handleStripeWebhook); // Stripe needs the raw body

module.exports = router;