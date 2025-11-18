// // Create a new file: controllers/utilsController.js
// const asyncHandler = require('express-async-handler');
// const axios = require('axios');

// // Simple in-memory cache to avoid hitting Paystack's API on every request
// let bankCache = null;
// let cacheTime = null;

// // @desc    Get list of Nigerian banks from Paystack
// // @route   GET /api/v1/utils/banks
// // @access  Public
// const getBankList = asyncHandler(async (req, res) => {
//     // If we have a cache and it's less than 24 hours old, use it
//     if (bankCache && cacheTime && (new Date() - cacheTime < 24 * 60 * 60 * 1000)) {
//         return res.status(200).json(bankCache);
//     }
    
//     const response = await axios.get('https://api.paystack.co/bank', {
//         headers: {
//             Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`
//         }
//     });

//     const banks = response.data.data;
//     bankCache = banks; // Store in cache
//     cacheTime = new Date(); // Set cache time

//     res.status(200).json(banks);
// });

// module.exports = { getBankList };






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