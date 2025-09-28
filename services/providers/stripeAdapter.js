const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../../models/User'); 
const Transaction = require('../../models/Transaction'); 
const { COMMISSION_RATE } = require('../../config/constants')


/**
 * Initializes a Stripe Checkout session for a one-time payment.
 * @param {string} email - The customer's email.
 * @param {number} amountKobo - The amount in Kobo.
 * @param {string} reference - Our unique internal transaction reference.
 * @param {object} videoDetails - Contains video title for the checkout page.
 * @returns {Promise<object>} - The checkout session object from Stripe, containing the URL.
 */
const initialize = async (email, amountKobo, reference, videoDetails) => {
    // Find or create a Stripe Customer to associate the payment with
    let customer = await stripe.customers.list({ email: email, limit: 1 });
    let customerId;

    if (customer.data.length > 0) {
        customerId = customer.data[0].id;
    } else {
        const newCustomer = await stripe.customers.create({ email });
        customerId = newCustomer.id;
    }

    const session = await stripe.checkout.sessions.create({
        payment_method_types: ['card'],
        mode: 'payment', // Important: 'payment' for one-time charges, not 'subscription'
        customer: customerId,
        line_items: [{
            price_data: {
                currency: 'ngn', // Assuming Nigerian Naira
                product_data: {
                    name: videoDetails.title,
                    description: `Access to "${videoDetails.title}"`,
                },
                unit_amount: amountKobo,
            },
            quantity: 1,
        }],
        // We use the session_id to verify on the frontend
        success_url: `${process.env.CLIENT_URL}/view/${videoDetails.slug}?stripe_session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/view/${videoDetails.slug}?status=cancelled`,
        metadata: {
            internalRef: reference, // Pass our internal reference to Stripe
        }
    });

    return { authorization_url: session.url }; // Return in a consistent format
};

/**
 * Verifies a payment with Stripe by retrieving the session.
 * @param {string} sessionId - The Stripe Checkout Session ID.
 * @returns {Promise<object>} - A custom object with status and metadata.
 */
const verify = async (sessionId) => {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    return {
        status: session.payment_status === 'paid' ? 'success' : 'failed',
        reference: session.metadata.internalRef,
        amount: session.amount_total,
    };
};

/**
 * Processes an incoming webhook from Stripe.
 * @param {object} req - The Express request object.
 * @returns {Promise<void>}
 */
const handleWebhook = async (req) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        throw new Error(`Stripe webhook signature verification failed: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const internalRef = session.metadata.internalRef;

        const transaction = await Transaction.findOne({ internalRef });
        
        if (transaction && transaction.status === 'pending') {
            const grossAmountKobo = session.amount_total;
            const commissionKobo = Math.round(grossAmountKobo * COMMISSION_RATE);
            const creatorEarningsKobo = grossAmountKobo - commissionKobo;

            transaction.status = 'successful';
            transaction.providerRef = session.id; // Stripe's session ID
            transaction.commissionKobo = commissionKobo;
            transaction.creatorEarningsKobo = creatorEarningsKobo;
            
            await transaction.save();
            console.log(`Stripe Webhook: Transaction ${transaction.internalRef} successfully updated.`);
        }
    }
};

module.exports = { initialize, verify, handleWebhook };