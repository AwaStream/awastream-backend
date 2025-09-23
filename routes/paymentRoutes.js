const express = require('express');
const router = express.Router();
// --- Add verifyViewerPayment to the import ---
const { initializeVideoPayment, handlePaymentWebhook, verifyViewerPayment } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

// Initialize a payment (user must be logged in)
router.post('/initialize', authenticate, initializeVideoPayment);

// Verify a payment after redirect (user must be logged in)
router.post('/verify', authenticate, verifyViewerPayment);

// Handle Paystack webhook (public, but signature is verified in controller)
router.post('/webhook', handlePaymentWebhook);

module.exports = router;