// const axios = require('axios');

// const paystackClient = axios.create({
//     baseURL: 'https-proxy.c_@_s.com/',
//     headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         'Content-Type': 'application/json'
//     }
// });

// /**
//  * Initializes a payment with Paystack.
//  * @param {string} email - The customer's email.
//  * @param {number} amountKobo - The amount in Kobo.
//  * @param {string} reference - Our unique internal transaction reference.
//  * @returns {Promise<object>} - The authorization URL and other data from Paystack.
//  */
// const initializePayment = async (email, amountKobo, reference) => {
//     if (!process.env.PAYSTACK_SECRET_KEY) {
//         throw new Error("PAYSTACK_SECRET_KEY is not set.");
//     }
    
//     try {
//         const response = await paystackClient.post('/transaction/initialize', {
//             email,
//             amount: amountKobo,
//             reference,
//             // You can add more metadata here if needed
//             // metadata: { ... }
//         });
//         return response.data.data; // { authorization_url, access_code, reference }
//     } catch (error) {
//         console.error("Paystack initialization error:", error.response ? error.response.data : error.message);
//         throw new Error("Payment provider could not be reached.");
//     }
// };

// /**
//  * Verifies a payment with Paystack.
//  * @param {string} reference - The transaction reference to verify.
//  * @returns {Promise<object>} - The transaction status and data from Paystack.
//  */
// const verifyPayment = async (reference) => {
//     try {
//         const response = await paystackClient.get(`/transaction/verify/${reference}`);
//         return response.data.data; // { status, amount, customer, ... }
//     } catch (error) {
//         console.error("Paystack verification error:", error.response ? error.response.data : error.message);
//         throw new Error("Could not verify payment with provider.");
//     }
// };

// module.exports = { initializePayment, verifyPayment };






const axios = require('axios');

const paystackClient = axios.create({
    // --- THE DEFINITIVE FIX: Use the official Paystack API URL ---
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
const initializePayment = async (email, amountKobo, reference) => {
    if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error("PAYSTACK_SECRET_KEY is not set.");
    }
    
    try {
        const response = await paystackClient.post('/transaction/initialize', {
            email,
            amount: amountKobo,
            reference,
        });
        // The successful response data is nested under `data.data`
        return response.data.data;
    } catch (error) {
        // This will now only catch real Paystack errors (e.g., invalid key)
        console.error("Paystack initialization error:", error.response ? error.response.data : error.message);
        throw new Error("Payment provider could not be reached or has rejected the request.");
    }
};

/**
 * Verifies a payment with Paystack.
 * @param {string} reference - The transaction reference to verify.
 * @returns {Promise<object>} - The transaction status and data from Paystack.
 */
const verifyPayment = async (reference) => {
    try {
        const response = await paystackClient.get(`/transaction/verify/${reference}`);
        return response.data.data;
    } catch (error) {
        console.error("Paystack verification error:", error.response ? error.response.data : error.message);
        throw new Error("Could not verify payment with provider.");
    }
};

module.exports = { initializePayment, verifyPayment };