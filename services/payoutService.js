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

const getBankList = async () => {
    const adapter = await getActivePayoutAdapter();
    if (!adapter.getBankList) {
        throw new Error("Active payout provider does not support fetching a bank list.");
    }
    return adapter.getBankList();
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


module.exports = {
    verifyBankAccount,
    createTransferRecipient,
    initiateTransfer,
    getBankList,
};