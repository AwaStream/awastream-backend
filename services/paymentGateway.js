const Settings = require('../models/Settings');
const paystack = require('./providers/paystackAdapter');
const stripe = require('./providers/stripeAdapter');
const nomba = require('./providers/nombaAdapter'); // <-- Add Nomba

// A single object to look up all providers
const providers = {
    paystack,
    stripe,
    nomba,
};

// This function reads from settings to decide which provider is active
const getActiveIncomingProvider = async () => {
    const settings = await Settings.findOne({ singleton: 'main_settings' });
    
    // Default to 'nomba' as requested
    const providerKey = settings?.incomingPaymentProvider || 'nomba'; 
    
    const provider = providers[providerKey];
    if (!provider) {
        console.error(`Config error: incomingPaymentProvider "${providerKey}" is not configured.`);
        // Fallback to nomba if misconfigured
        return { provider: providers.nomba, providerKey: 'nomba' }; 
    }
    // Return both the provider's functions and its name
    return { provider, providerKey };
};

// Initializes payment with the *currently active* provider
const initializePayment = async (email, amountKobo, ref, productDetails) => {
    const { provider } = await getActiveIncomingProvider();
    return provider.initialize(email, amountKobo, ref, productDetails);
};

// NEW: Verifies payment using the *specific provider* stored in the transaction
const verifyPayment = async (providerKey, reference) => {
    const provider = providers[providerKey];
    if (!provider || !provider.verify) {
        throw new Error(`Invalid or unsupported payment provider for verification: ${providerKey}`);
    }
    return provider.verify(reference);
};

// These are provider-specific webhook handlers
const handlePaystackWebhook = (req) => {
    return providers.paystack.handleWebhook(req);
};

const handleStripeWebhook = (req) => {
    return providers.stripe.handleWebhook(req);
};

// TODO: Add handleNombaWebhook when we are ready

module.exports = { 
    initializePayment, 
    verifyPayment, // This is now specific
    getActiveIncomingProvider, // Expose this for the controller
    handlePaystackWebhook,
    handleStripeWebhook,
    getTransferAccount: nomba.getTransferAccount,
};