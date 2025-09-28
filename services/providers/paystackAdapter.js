const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../../models/Transaction'); // Adjust the path to your model as needed
const { COMMISSION_RATE } = require('../../config/constants');

const paystackClient = axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

/**
 * Initializes a payment with Paystack.
 * @param {string} email - The customer's email.
 * @param {number} amountKobo - The amount in Kobo.
 * @param {string} reference - Our unique internal transaction reference.
 * @returns {Promise<object>} - The authorization URL and other data from Paystack.
 */
const initialize = async (email, amountKobo, reference) => {
    if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error("PAYSTACK_SECRET_KEY is not set.");
    }
    
    try {
        const response = await paystackClient.post('/transaction/initialize', {
            email,
            amount: amountKobo,
            reference,
        });
        return response.data.data;
    } catch (error) {
        console.error("Paystack initialization error:", error.response ? error.response.data : error.message);
        throw new Error("Payment provider could not be reached or has rejected the request.");
    }
};

/**
 * Verifies a payment with Paystack.
 * @param {string} reference - The transaction reference to verify.
 * @returns {Promise<object>} - The transaction status and data from Paystack.
 */
const verify = async (reference) => {
    try {
        const response = await paystackClient.get(`/transaction/verify/${reference}`);
        return response.data.data;
    } catch (error) {
        console.error("Paystack verification error:", error.response ? error.response.data : error.message);
        throw new Error("Could not verify payment with provider.");
    }
};

/**
 * Processes an incoming webhook from Paystack.
 * @param {object} req - The Express request object containing the webhook body and headers.
 * @returns {Promise<void>}
 */
const handleWebhook = async (req) => {
    // 1. Verify the webhook signature for security
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
        throw new Error("Invalid webhook signature.");
    }
    
    const { event, data } = req.body;

    // 2. We only care about successful charges
    if (event === 'charge.success') {
        const internalRef = data.reference;
        console.log('--- PROCESSING WEBHOOK ---');
        console.log('Webhook data from Paystack:', data); // Log the whole object


        const transaction = await Transaction.findOne({ internalRef });

        // 3. Find the transaction and ensure it hasn't already been processed
        if (transaction && transaction.status === 'pending') {
            
            // 4. Update the transaction with the final details
            const grossAmountKobo = data.amount;
            console.log('Gross amount from webhook:', grossAmountKobo, 'Type:', typeof grossAmountKobo); // Check amount and type
            const commissionKobo = Math.round(grossAmountKobo * COMMISSION_RATE);
            const creatorEarningsKobo = grossAmountKobo - commissionKobo;

            transaction.status = 'successful';
            transaction.providerRef = data.id.toString(); // Paystack's unique ID for the charge
            transaction.commissionKobo = commissionKobo;
            transaction.creatorEarningsKobo = creatorEarningsKobo;
            
            await transaction.save();
            console.log(`Webhook processed: Transaction ${transaction.internalRef} successfully updated.`);
        }
    }
};


module.exports = { 
    initialize, 
    verify,
    handleWebhook // Export the new function
};