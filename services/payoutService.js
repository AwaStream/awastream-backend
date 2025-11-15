// const axios = require('axios');
// const crypto = require('crypto');
// const User = require('../models/User');
// const Payout = require('../models/Payout');

// const paystackClient = axios.create({
//     baseURL: 'https://api.paystack.co',
//     headers: {
//         Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
//         'Content-Type': 'application/json'
//     }
// });

// /**
//  * Verifies a creator's bank account details with Paystack.
//  * @param {string} accountNumber The creator's bank account number.
//  * @param {string} bankCode The Paystack code for the creator's bank.
//  * @returns {Promise<object>} The verification data from Paystack.
//  */
// const verifyBankAccount = async (accountNumber, bankCode) => {
//     try {
//         const response = await paystackClient.get(`/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`);
//         return response.data.data;
//     } catch (error) {
//         console.error("Paystack bank verification error:", error.response ? error.response.data : error.message);
//         throw new Error(error.response?.data?.message || "Could not verify bank account details.");
//     }
// };

// /**
//  * Creates a reusable Transfer Recipient on Paystack.
//  * @param {object} creator The creator's user object.
//  * @returns {Promise<string>} The recipient code from Paystack (e.g., "RCP_...").
//  */
// const createTransferRecipient = async (creator) => {
//     try {
//         const response = await paystackClient.post('/transferrecipient', {
//             type: "nuban",
//             name: creator.payoutAccountName,
//             account_number: creator.payoutAccountNumber,
//             bank_code: creator.payoutBankName, // Assumes you store the bank code here
//             currency: "NGN",
//         });
//         return response.data.data.recipient_code;
//     } catch (error) {
//         console.error("Paystack create recipient error:", error.response ? error.response.data : error.message);
//         throw new Error(error.response?.data?.message || "Could not create payout recipient.");
//     }
// };

// /**
//  * Initiates the actual transfer to a creator.
//  * @param {number} amountKobo The amount in kobo to send.
//  * @param {string} recipientCode The recipient code for the creator.
//  * @param {string} payoutId The internal ID of our payout document for reference.
//  * @returns {Promise<object>} The transfer data from Paystack.
//  */
// const initiateTransfer = async (amountKobo, recipientCode, payoutId) => {
//     try {
//         const reference = `payout_${payoutId}_${Date.now()}`;
//         const response = await paystackClient.post('/transfer', {
//             source: "balance",
//             amount: amountKobo,
//             recipient: recipientCode,
//             reason: `Creator Payout - ${payoutId}`,
//             reference: reference,
//         });
//         return response.data.data;
//     } catch (error) {
//         console.error("Paystack initiate transfer error:", error.response ? error.response.data : error.message);
//         throw new Error(error.response?.data?.message || "Payment provider failed to initiate transfer.");
//     }
// };

// /**
//  * Handles incoming webhooks for transfer events from Paystack.
//  * @param {object} req The Express request object.
//  */
// const handleTransferWebhook = async (req) => {
//     const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
//     const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
//     if (hash !== req.headers['x-paystack-signature']) {
//         throw new Error("Invalid webhook signature.");
//     }

//     const { event, data } = req.body;
    
//     // Use the transfer_code from the webhook data to find the Payout
//     const payout = await Payout.findOne({ providerRef: data.transfer_code });
//     if (!payout) {
//         console.warn(`Webhook received for unknown transfer code: ${data.transfer_code}`);
//         return;
//     }
    
//     if (payout.status === 'completed') {
//         console.log(`Webhook for already completed payout ${payout._id} received. Ignoring.`);
//         return;
//     }

//     if (event === 'transfer.success') {
//         payout.status = 'completed';
//         payout.processedAt = new Date(data.transferred_at);
//         console.log(`Payout ${payout._id} completed successfully via webhook.`);
//     } else if (event === 'transfer.failed') {
//         payout.status = 'failed';
//         payout.notes = data.failure_reason || 'Transfer failed at the provider.';
//         console.log(`Payout ${payout._id} failed via webhook. Reason: ${payout.notes}`);
//     } else if (event === 'transfer.reversed') {
//         payout.status = 'failed';
//         payout.notes = 'Transfer was reversed by the provider.';
//         console.log(`Payout ${payout._id} was reversed via webhook.`);
//     }

//     await payout.save();
// };

// module.exports = {
//     verifyBankAccount,
//     createTransferRecipient,
//     initiateTransfer,
//     handleTransferWebhook,
// };



const Settings = require('../models/Settings');
const paystackAdapter = require('./providers/paystackAdapter');
const nombaAdapter = require('./providers/nombaAdapter');

// Helper to get the active adapter based on settings
const getActivePayoutAdapter = async () => {
    const settings = await Settings.findOne({ singleton: 'main_settings' });
    const provider = settings?.payoutProvider || 'nomba'; // Default to nomba if settings missing
    
    if (provider === 'nomba') return nombaAdapter;
    return paystackAdapter;
};

// Unified verify function
const verifyBankAccount = async (accountNumber, bankCode) => {
    const adapter = await getActivePayoutAdapter();
    return adapter.verifyBankAccount(accountNumber, bankCode);
};

// Unified recipient creation
const createTransferRecipient = async (creator) => {
    const adapter = await getActivePayoutAdapter();
    // Nomba doesn't strictly need this, but we keep the interface consistent
    return adapter.createTransferRecipient(creator);
};

// Unified transfer initiation
// NOTE: We added 'creator' parameter because Nomba needs the raw bank details again, 
// whereas Paystack only needed the recipientCode.
const initiateTransfer = async (amountKobo, creator, payoutId) => {
    const adapter = await getActivePayoutAdapter();
    
    // Pass 'creator' object so Nomba adapter can extract account numbers directly
    // Paystack adapter will just ignore the extra arguments it doesn't need
    return adapter.initiateTransfer(
        amountKobo, 
        creator.paystackRecipientCode, // Used by Paystack
        payoutId,
        creator // Used by Nomba to get raw acc number & bank code
    );
};

// ... handleTransferWebhook remains (we'll need a Nomba specific one later if you want real-time updates)

module.exports = {
    verifyBankAccount,
    createTransferRecipient,
    initiateTransfer,
    // handleTransferWebhook // Keep your existing Paystack one for now, we can add Nomba's later
};