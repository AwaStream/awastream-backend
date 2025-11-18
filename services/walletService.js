const Wallet = require('../models/Wallet');
const nombaAdapter = require('./providers/nombaAdapter');

const getOrCreateWallet = async (user) => {
    // 1. Check if wallet already exists
    let wallet = await Wallet.findOne({ user: user._id });
    
    if (wallet) {
        return wallet;
    }

    // 2. If not, create one using Nomba
    console.log(`Creating new wallet for user ${user._id}`);
    
    try {
        const accountData = await nombaAdapter.createVirtualAccount(
            user._id, 
            user.email, 
            `${user.firstName} ${user.lastName}`
        );

        // 3. Save to our separate Wallet collection
        wallet = await Wallet.create({
            user: user._id,
            balanceKobo: 0,
            accountDetails: {
                bankName: accountData.bankName,
                accountName: accountData.accountName,
                accountNumber: accountData.accountNumber,
                accountRef: accountData.reference
            }
        });

        return wallet;

    } catch (error) {
        console.error("Wallet Creation Failed:", error);
        throw error;
    }
};

const getWalletBalance = async (userId) => {
    const wallet = await Wallet.findOne({ user: userId });
    if (!wallet) return 0;
    return wallet.balanceKobo;
};

module.exports = {
    getOrCreateWallet,
    getWalletBalance
};