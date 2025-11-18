const asyncHandler = require('express-async-handler');
const payoutService = require('../services/payoutService'); // Import our unified service

/**
 * @desc    Get list of banks from the *currently active* payout provider
 * @route   GET /api/v1/utils/banks
 * @access  Public
 */
const getBankList = asyncHandler(async (req, res) => {
    try {
        // This will now dynamically call Paystack OR Nomba
        const banks = await payoutService.getBankList(); 
        res.status(200).json(banks);
    } catch (error) {
        console.error("Failed to get bank list from provider:", error);
        res.status(500).json({ message: "Could not retrieve bank list." });
    }
});

module.exports = { getBankList };