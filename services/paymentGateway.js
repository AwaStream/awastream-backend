const paystack = require('./providers/paystackAdapter');
const stripe = require('./providers/stripeAdapter');

const providers = {
    paystack,
    stripe,
};

// This function reads from your .env to decide which provider is active
const getProvider = () => {
    const providerKey = process.env.ACTIVE_PAYMENT_PROVIDER || 'paystack';
    const provider = providers[providerKey];
    if (!provider) {
        throw new Error(`Payment provider "${providerKey}" is not configured.`);
    }
    return provider;
};

// These functions call the active provider's methods
const initializePayment = (email, amountKobo, ref, videoDetails) => {
    return getProvider().initialize(email, amountKobo, ref, videoDetails);
};

const verifyPayment = (reference) => {
    return getProvider().verify(reference);
};

// These are now provider-specific webhook handlers
const handlePaystackWebhook = (req) => {
    return providers.paystack.handleWebhook(req);
};

const handleStripeWebhook = (req) => {
    return providers.stripe.handleWebhook(req);
};

module.exports = { 
    initializePayment, 
    verifyPayment,
    handlePaystackWebhook,
    handleStripeWebhook,
};