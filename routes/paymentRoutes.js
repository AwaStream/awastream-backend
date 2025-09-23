const express = require('express');
const router = express.Router();
const { initializeVideoPayment, handlePaymentWebhook } = require('../controllers/paymentController');
const { authenticate } = require('../middleware/authMiddleware');

// A logged-in user initializes a payment
router.post('/initialize', authenticate, initializeVideoPayment);

// The public webhook that the payment provider calls
router.post('/webhook', handlePaymentWebhook);

module.exports = router;