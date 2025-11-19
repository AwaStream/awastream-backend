// const crypto = require('crypto')
// const Payout = require('../../models/Payout');
// const Transaction = require('../../models/Transaction');
// const axios = require('axios');

// // Use Sandbox URL for development, Live for production
// const BASE_URL = process.env.NODE_ENV === 'production' 
//     ? 'https://api.nomba.com/v1' 
//     : 'https://sandbox.nomba.com/v1';

// // --- Cache variables MUST be defined at the top !! ---
// let cachedToken = null;
// let tokenExpiry = null;
// let bankListCache = null;
// // ------------------------------------------------------------------

// const getAuthHeaders = async () => {
//     // 1. Check if we have a valid cached token
//     if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
//         return {
//             headers: {
//                 'Authorization': `Bearer ${cachedToken}`,
//                 'accountId': process.env.NOMBA_ACCOUNT_ID, 
//                 'Content-Type': 'application/json'
//             }
//         };
//     }

//     // 2. If not, fetch a new one
//     console.log("[Nomba Auth] No valid cache, fetching new token...");
//     try {
//         const authPayload = {
//             grant_type: 'client_credentials',
//             client_id: process.env.NOMBA_CLIENT_ID,
//             client_secret: process.env.NOMBA_CLIENT_SECRET
//         };

//         const authHeaders = {
//             'accountId': process.env.NOMBA_ACCOUNT_ID,
//             'Content-Type': 'application/json'
//         };

//         const fetchResponse = await fetch(`${BASE_URL}/auth/token/issue`, {
//             method: 'POST',
//             headers: authHeaders,
//             body: JSON.stringify(authPayload)
//         });

//         const responseData = await fetchResponse.json();
        
//         if (fetchResponse.ok && responseData.code === '00') {
//             console.log("[Nomba Auth] Successfully fetched new token.");
//             cachedToken = responseData.data.access_token;
//             const expiresInSeconds = responseData.data.expires_in || 3600;
//             tokenExpiry = new Date(new Date().getTime() + (expiresInSeconds - 300) * 1000);
            
//             return {
//                 headers: {
//                     'Authorization': `Bearer ${cachedToken}`,
//                     'accountId': process.env.NOMBA_ACCOUNT_ID, 
//                     'Content-Type': 'application/json'
//                 }
//             };
//         } else {
//             console.error("[Nomba Auth] Failed to obtain token:", responseData);
//             throw new Error(responseData.description || 'Failed to obtain Nomba access token');
//         }
//     } catch (error) {
//         console.error("Nomba Auth Error:", error.message);
//         throw new Error("Could not authenticate with Nomba.");
//     }
// };

// const getBankList = async () => {
//     if (bankListCache) {
//         console.log("[Nomba Bank] Using cached bank list.");
//         return bankListCache;
//     }

//     try {
//         const config = await getAuthHeaders();
//         // Remove Content-Type for GET requests
//         const getHeaders = { ...config.headers };
//         delete getHeaders['Content-Type'];

//         console.log("[Nomba Bank] Fetching from endpoint: /transfers/banks");
        
//         // --- !! FIX: Using the Documented Endpoint !! ---
//         const fetchResponse = await fetch(`${BASE_URL}/transfers/banks`, {
//             method: 'GET',
//             headers: getHeaders
//         });

//         const responseData = await fetchResponse.json();

//         if (responseData.code === '00' && responseData.data) {
//             console.log("[Nomba Bank] Successfully fetched new bank list.");
//             // Map fields based on the documentation
//             bankListCache = responseData.data.map(bank => ({
//                 code: bank.code, // Nomba docs say 'code'
//                 name: bank.name.toUpperCase() // Nomba docs say 'name'
//             }));
//             return bankListCache;
//         } else {
//             console.warn("[Nomba Bank] API call failed to fetch list:", responseData);
//             throw new Error(responseData.description || "Failed to fetch bank list.");
//         }
//     } catch (error) {
//         console.error("---!! NOMBA getBankList ERROR !!---");
//         console.error(error);
//         throw new Error("Could not fetch bank list.");
//     }
// };

// const initialize = async (email, amountKobo, internalRef, productDetails) => {
//     try {
//         const config = await getAuthHeaders();
        
//         const amountNaira = (amountKobo / 100).toFixed(2);
//         const callbackUrl = `${process.env.CLIENT_URL}/view/${productDetails.productType.toLowerCase()}/${productDetails.slug}?payment=successful`;

//         const payload = {
//             order: {
//                 orderReference: internalRef,
//                 customerId: email,
//                 callbackUrl: callbackUrl,
//                 customerEmail: email,
//                 amount: amountNaira,
//                 currency: "NGN",
//                 description: productDetails.title || "AwaStream Product"
//             }
//         };

//         const response = await axios.post(`${BASE_URL}/checkout/order`, payload, config);

//         if (response.data.code === '00') {
//             return {
//                 authorization_url: response.data.data.checkoutLink,
//                 reference: internalRef 
//             };
//         } else {
//             throw new Error(response.data.description || "Checkout order creation failed");
//         }
//     } catch (error) {
//         console.error("Nomba Initialize Error:", error.response?.data || error.message);
//         throw new Error(error.response?.data?.description || "Nomba failed to initialize payment.");
//     }
// };

// const verify = async (orderReference) => {
//     try {
//         const config = await getAuthHeaders();
//         const getHeaders = { ...config.headers };
//         delete getHeaders['Content-Type'];

//         console.log(`[Nomba Verify] Verifying Reference: ${orderReference}`);

//         // --- CORRECTED ENDPOINT (Singular 'transaction') ---
//         // Docs: https://developer.nomba.com/nomba-api-reference/online-checkout/fetch-checkout-transaction
//         const fetchResponse = await fetch(
//             `${BASE_URL}/checkout/transaction?idType=ORDER_REFERENCE&id=${orderReference}`, 
//             {
//                 method: 'GET',
//                 headers: getHeaders
//             }
//         );
        
//         const responseData = await fetchResponse.json();
//         console.log("[Nomba Verify] API Response:", JSON.stringify(responseData, null, 2));

//         if (responseData.code === '00' && responseData.data) {
//             const data = responseData.data;
            
//             // Nomba returns 'true' (string or boolean) for success
//             if (String(data.success) === 'true' || data.message === 'success') {
//                 return {
//                     status: 'success',
//                     amount: Math.round(parseFloat(data.order.amount) * 100),
//                     reference: orderReference,
//                     id: data.transactionDetails?.id || orderReference
//                 };
//             } else {
//                 return { status: 'failed' };
//             }
//         }

//         return { status: 'failed' };

//     } catch (error) {
//         console.error("Nomba Verify Error:", error.message);
//         return { status: 'failed' }; 
//     }
// };

// const verifyBankAccount = async (accountNumber, bankCode) => {
//     try {
//         const config = await getAuthHeaders();
//         // This is a POST request, so axios + Content-Type is fine
//         const response = await axios.post(`${BASE_URL}/transfers/bank/lookup`, {
//             accountNumber,
//             bankCode
//         }, config);

//         if (response.data.code === '00') {
//             return {
//                 account_name: response.data.data.accountName,
//                 account_number: accountNumber,
//                 bank_id: bankCode
//             };
//         }
//         throw new Error("Account lookup failed");
//     } catch (error) {
//         console.error("Nomba Lookup Error:", error.response?.data || error.message);
//         throw new Error(error.response?.data?.description || "Could not verify bank account details.");
//     }
// };

// const createTransferRecipient = async (creator) => {
//     return "NOMBA_NO_RECIPIENT_NEEDED";
// };

// const getTransferAccount = async (orderReference) => {
//     try {
//         const config = await getAuthHeaders();
//         const getHeaders = { ...config.headers };
//         delete getHeaders['Content-Type'];
        
//         const fetchResponse = await fetch(
//             `${BASE_URL}/checkout/get-checkout-kta/${orderReference}`, 
//             { method: 'GET', headers: getHeaders }
//         );
//         const responseData = await fetchResponse.json();

//         if (responseData.code === '00') {
//             return responseData.data;
//         } else {
//             throw new Error(responseData.description || "Failed to get transfer account");
//         }
//     } catch (error) {
//         console.error("Nomba getTransferAccount Error:", error.message);
//         throw new Error(error.message || "Could not get bank transfer details.");
//     }
// };

// const initiateTransfer = async (amountKobo, recipientCode, payoutId, creatorDetails) => {
//     try {
//         const config = await getAuthHeaders();
        
//         // 1. Get the bank list
//         const bankList = await getBankList(); 
        
//         // 2. Find the matching bank code
//         const creatorBankName = creatorDetails.payoutBankName.toUpperCase();
//         const matchingBank = bankList.find(bank => bank.name.toUpperCase() === creatorBankName); 
        
//         if (!matchingBank) {
//             throw new Error(`Bank not found or name mismatch for: ${creatorDetails.payoutBankName}. Payout bank name must match the name from the /utils/banks list exactly.`);
//         }
//         // 3. Use the correct code
//         const bankCodeToSend = matchingBank.code;

//         // Nomba prefers amounts as strings with 2 decimal places (e.g., "100.00")
//         const amountNaira = (amountKobo / 100).toFixed(2);

//         // Use a robust reference
//         const myTxRef = `PAYOUT-${payoutId}`;

//         const payload = {
//             amount: amountNaira,
//             accountNumber: creatorDetails.payoutAccountNumber,
//             accountName: creatorDetails.payoutAccountName,
//             bankCode: bankCodeToSend,
//             merchantTxRef: myTxRef,
//             senderName: "AwaStream Inc",
//             narration: `Payout for AwaStream Sales`
//         };

//         // Transfer Endpoint: POST /v1/transfers/bank
//         const response = await axios.post(`${BASE_URL}/transfers/bank`, payload, config);
//         const responseBody = response.data;

//         // Log the raw response for debugging
//         console.log(`[Nomba Transfer] Response Code: ${responseBody.code}, Desc: ${responseBody.description}`);

//         // --- FIX START: Accept '00' OR 'Processing' description ---
//         // Sometimes Nomba returns a non-00 code (like '09') with description 'Processing'. 
//         // We must treat this as a valid PENDING state, not an error.
//         const isSuccessCode = responseBody.code === '00';
//         const isProcessingDesc = responseBody.description && responseBody.description.toLowerCase() === 'processing';

//         if (isSuccessCode || isProcessingDesc) {
//             const nombaData = responseBody.data || {}; 
//             const nombaStatus = nombaData.status || 'PROCESSING';
            
//             let internalStatus = 'failed';
            
//             if (nombaStatus === 'SUCCESS') {
//                 internalStatus = 'successful';
//             } else if (nombaStatus === 'PROCESSING' || nombaStatus === 'PENDING' || isProcessingDesc) {
//                 internalStatus = 'pending';
//             }

//             // Fallback values if data object is missing (common in 'Processing' responses)
//             return {
//                 reference: nombaData.meta?.rrn || nombaData.id || myTxRef, 
//                 status: internalStatus, 
//                 gateway_id: nombaData.id || myTxRef
//             };
//         } 
//         // --- FIX END ---
        
//         else {
//             // Only throw if it's truly a failure (not 00 and not Processing)
//             throw new Error(responseBody.description || "Transfer declined by Nomba.");
//         }
//     } catch (error) {
//         console.error("Nomba Transfer Error:", error.response?.data || error.message);
//         throw new Error(error.response?.data?.description || error.message || "Nomba failed to initiate transfer.");
//     }
// };


// // --- 3. VERIFY PAYOUT STATUS (NEW: FIXES "STUCK IN PROCESSING") ---
// const verifyTransfer = async (payoutId) => {
//     try {
//         const config = await getAuthHeaders();
//         const merchantTxRef = `PAYOUT-${payoutId}`;
        
//         // Endpoint: Fetch single transaction by merchant reference
//         // This allows us to ask Nomba "What is the status of this specific payout?"
//         const response = await axios.get(
//             `${BASE_URL}/transactions/accounts/single?merchantTxRef=${merchantTxRef}`,
//             config
//         );

//         if (response.data.code === '00' && response.data.data) {
//             const result = response.data.data;
//             let status = 'pending';

//             // Map Nomba statuses to AwaStream statuses
//             const s = result.status;
//             if (s === 'SUCCESS' || s === 'PAYMENT_SUCCESSFUL' || s === 'PAID') {
//                 status = 'successful';
//             } else if (s === 'FAILED' || s === 'PAYMENT_FAILED' || s === 'REVERSED') {
//                 status = 'failed';
//             }

//             return {
//                 status: status,
//                 reference: result.rrn || result.id,
//                 gateway_id: result.id
//             };
//         }
        
//         // If not found, it remains pending
//         return { status: 'pending' };
//     } catch (error) {
//         console.error("Nomba Verify Transfer Error:", error.message);
//         // Return pending on error so we can try again later
//         return { status: 'pending' };
//     }
// };


// const handleWebhook = async (req) => {
//     const secret = process.env.NOMBA_CLIENT_SECRET; // Nomba uses Client Secret for signature
//     const signature = req.headers['x-nomba-signature'];
    
//     // 1. Security: Verify the request comes from Nomba
//     // (Skip verification in Dev if needed, but Essential for Prod)
//     if (process.env.NODE_ENV === 'production') {
//         if (!signature) {
//             throw new Error('No signature provided');
//         }
//         const hash = crypto.createHmac('sha512', secret)
//             .update(JSON.stringify(req.body))
//             .digest('hex');
        
//         if (hash !== signature) {
//             throw new Error('Invalid webhook signature');
//         }
//     }

//     const payload = req.body;
//     console.log(`[Nomba Webhook] Event Received: ${payload.type || 'Unknown'}`);

//     // 2. Handle Payout Updates (Transfer to Creator)
//     if (payload.type === 'transfer.success' || payload.type === 'transfer.failed') {
//         const data = payload.data;
//         // We saved the reference as "PAYOUT-{id}" in initiateTransfer
//         const merchantRef = data.merchantTxRef; 

//         if (merchantRef && merchantRef.startsWith('PAYOUT-')) {
//             const payoutId = merchantRef.replace('PAYOUT-', '');
//             const payout = await Payout.findById(payoutId);

//             if (payout) {
//                 if (payload.type === 'transfer.success') {
//                     payout.status = 'completed';
//                     payout.processedAt = new Date();
//                     console.log(`[Nomba Webhook] Payout ${payoutId} marked as COMPLETED`);
//                 } else {
//                     payout.status = 'failed';
//                     payout.notes = data.message || "Transfer failed";
//                     console.log(`[Nomba Webhook] Payout ${payoutId} marked as FAILED`);
//                     // Note: Balance restores automatically because we only sum 'completed/processing' payouts
//                 }
//                 await payout.save();
//             }
//         }
//     }

//     // 3. Handle Incoming Payment Updates (Checkout)
//     // This covers cases where user closed browser before redirect
//     if (payload.type === 'checkout.order.completed') {
//         const data = payload.data;
//         const internalRef = data.orderReference;

//         const transaction = await Transaction.findOne({ internalRef });

//         if (transaction && transaction.status === 'pending') {
//             // Verify the amount matches
//             const paidAmount = parseFloat(data.amount);
//             const expectedAmount = transaction.amountKobo / 100;

//             if (paidAmount >= expectedAmount) {
//                 transaction.status = 'successful';
//                 transaction.providerRef = data.id;
//                 await transaction.save();
//                 console.log(`[Nomba Webhook] Transaction ${internalRef} marked as SUCCESSFUL`);
//                 // TODO: Trigger your sale notification logic here if needed
//             }
//         }
//     }

//     return true;
// };


// module.exports = {
//     initialize,
//     verify,
//     verifyBankAccount,
//     createTransferRecipient,
//     initiateTransfer,
//     getTransferAccount,
//     verifyTransfer,
//     getBankList,
//     handleWebhook,
// };


const crypto = require('crypto');
const Payout = require('../../models/Payout');
const Transaction = require('../../models/Transaction');
const axios = require('axios');

// Use Sandbox URL for development, Live for production
const BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.nomba.com/v1' 
    : 'https://api.nomba.com/v1'; // Sandbox uses same base, just different keys

// --- Cache variables MUST be defined at the top !! ---
let cachedToken = null;
let tokenExpiry = null;
let bankListCache = null;
// ------------------------------------------------------------------

const getAuthHeaders = async () => {
    // 1. Check if we have a valid cached token
    if (cachedToken && tokenExpiry && new Date() < tokenExpiry) {
        return {
            headers: {
                'Authorization': `Bearer ${cachedToken}`,
                'accountId': process.env.NOMBA_ACCOUNT_ID, 
                'Content-Type': 'application/json'
            }
        };
    }

    // 2. If not, fetch a new one
    console.log("[Nomba Auth] No valid cache, fetching new token...");
    try {
        const authPayload = {
            grant_type: 'client_credentials',
            client_id: process.env.NOMBA_CLIENT_ID,
            client_secret: process.env.NOMBA_CLIENT_SECRET
        };

        const authHeaders = {
            'accountId': process.env.NOMBA_ACCOUNT_ID,
            'Content-Type': 'application/json'
        };

        const fetchResponse = await fetch(`${BASE_URL}/auth/token/issue`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(authPayload)
        });

        const responseData = await fetchResponse.json();
        
        if (fetchResponse.ok && responseData.code === '00') {
            console.log("[Nomba Auth] Successfully fetched new token.");
            cachedToken = responseData.data.access_token;
            const expiresInSeconds = responseData.data.expires_in || 3600;
            tokenExpiry = new Date(new Date().getTime() + (expiresInSeconds - 300) * 1000);
            
            return {
                headers: {
                    'Authorization': `Bearer ${cachedToken}`,
                    'accountId': process.env.NOMBA_ACCOUNT_ID, 
                    'Content-Type': 'application/json'
                }
            };
        } else {
            console.error("[Nomba Auth] Failed to obtain token:", responseData);
            throw new Error(responseData.description || 'Failed to obtain Nomba access token');
        }
    } catch (error) {
        console.error("Nomba Auth Error:", error.message);
        throw new Error("Could not authenticate with Nomba.");
    }
};

const getBankList = async () => {
    if (bankListCache) {
        console.log("[Nomba Bank] Using cached bank list.");
        return bankListCache;
    }

    try {
        const config = await getAuthHeaders();
        // Remove Content-Type for GET requests
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];

        console.log("[Nomba Bank] Fetching from endpoint: /transfers/banks");
        
        const fetchResponse = await fetch(`${BASE_URL}/transfers/banks`, {
            method: 'GET',
            headers: getHeaders
        });

        const responseData = await fetchResponse.json();

        if (responseData.code === '00' && responseData.data) {
            console.log("[Nomba Bank] Successfully fetched new bank list.");
            // Map fields based on the documentation
            bankListCache = responseData.data.map(bank => ({
                code: bank.code, // Nomba docs say 'code'
                name: bank.name.toUpperCase() // Nomba docs say 'name'
            }));
            return bankListCache;
        } else {
            console.warn("[Nomba Bank] API call failed to fetch list:", responseData);
            throw new Error(responseData.description || "Failed to fetch bank list.");
        }
    } catch (error) {
        console.error("---!! NOMBA getBankList ERROR !!---");
        console.error(error);
        throw new Error("Could not fetch bank list.");
    }
};

const initialize = async (email, amountKobo, internalRef, productDetails) => {
    try {
        const config = await getAuthHeaders();
        
        const amountNaira = (amountKobo / 100).toFixed(2);
        const callbackUrl = `${process.env.CLIENT_URL}/view/${productDetails.productType.toLowerCase()}/${productDetails.slug}?payment=successful`;

        const payload = {
            order: {
                orderReference: internalRef,
                customerId: email,
                callbackUrl: callbackUrl,
                customerEmail: email,
                amount: amountNaira,
                currency: "NGN",
                description: productDetails.title || "AwaStream Product"
            }
        };

        const response = await axios.post(`${BASE_URL}/checkout/order`, payload, config);

        if (response.data.code === '00') {
            return {
                authorization_url: response.data.data.checkoutLink,
                reference: internalRef 
            };
        } else {
            throw new Error(response.data.description || "Checkout order creation failed");
        }
    } catch (error) {
        console.error("Nomba Initialize Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || "Nomba failed to initialize payment.");
    }
};

const verify = async (orderReference) => {
    try {
        const config = await getAuthHeaders();
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];

        console.log(`[Nomba Verify] Verifying Reference: ${orderReference}`);

        // Docs: https://developer.nomba.com/nomba-api-reference/online-checkout/fetch-checkout-transaction
        const fetchResponse = await fetch(
            `${BASE_URL}/checkout/transaction?idType=ORDER_REFERENCE&id=${orderReference}`, 
            {
                method: 'GET',
                headers: getHeaders
            }
        );
        
        const responseData = await fetchResponse.json();
        console.log("[Nomba Verify] API Response:", JSON.stringify(responseData, null, 2));

        if (responseData.code === '00' && responseData.data) {
            const data = responseData.data;
            
            // Nomba returns 'true' (string or boolean) for success
            if (String(data.success) === 'true' || data.message === 'success') {
                return {
                    status: 'success',
                    amount: Math.round(parseFloat(data.order.amount) * 100),
                    reference: orderReference,
                    id: data.transactionDetails?.id || orderReference
                };
            } else {
                return { status: 'failed' };
            }
        }

        return { status: 'failed' };

    } catch (error) {
        console.error("Nomba Verify Error:", error.message);
        return { status: 'failed' }; 
    }
};

const verifyBankAccount = async (accountNumber, bankCode) => {
    try {
        const config = await getAuthHeaders();
        const response = await axios.post(`${BASE_URL}/transfers/bank/lookup`, {
            accountNumber,
            bankCode
        }, config);

        if (response.data.code === '00') {
            return {
                account_name: response.data.data.accountName,
                account_number: accountNumber,
                bank_id: bankCode
            };
        }
        throw new Error("Account lookup failed");
    } catch (error) {
        console.error("Nomba Lookup Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || "Could not verify bank account details.");
    }
};

const createTransferRecipient = async (creator) => {
    return "NOMBA_NO_RECIPIENT_NEEDED";
};

const getTransferAccount = async (orderReference) => {
    try {
        const config = await getAuthHeaders();
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];
        
        const fetchResponse = await fetch(
            `${BASE_URL}/checkout/get-checkout-kta/${orderReference}`, 
            { method: 'GET', headers: getHeaders }
        );
        const responseData = await fetchResponse.json();

        if (responseData.code === '00') {
            return responseData.data;
        } else {
            throw new Error(responseData.description || "Failed to get transfer account");
        }
    } catch (error) {
        console.error("Nomba getTransferAccount Error:", error.message);
        throw new Error(error.message || "Could not get bank transfer details.");
    }
};

const initiateTransfer = async (amountKobo, recipientCode, payoutId, creatorDetails) => {
    try {
        const config = await getAuthHeaders();
        
        // 1. Get the bank list
        const bankList = await getBankList(); 
        
        // 2. Find the matching bank code
        const creatorBankName = creatorDetails.payoutBankName.toUpperCase();
        const matchingBank = bankList.find(bank => bank.name.toUpperCase() === creatorBankName); 
        
        if (!matchingBank) {
            throw new Error(`Bank not found or name mismatch for: ${creatorDetails.payoutBankName}. Payout bank name must match the name from the /utils/banks list exactly.`);
        }
        // 3. Use the correct code
        const bankCodeToSend = matchingBank.code;

        // Nomba prefers amounts as strings with 2 decimal places (e.g., "100.00")
        const amountNaira = (amountKobo / 100).toFixed(2);

        // Use a robust reference
        const myTxRef = `PAYOUT-${payoutId}`;

        const payload = {
            amount: amountNaira,
            accountNumber: creatorDetails.payoutAccountNumber,
            accountName: creatorDetails.payoutAccountName,
            bankCode: bankCodeToSend,
            merchantTxRef: myTxRef,
            senderName: "AwaStream Inc",
            narration: `Payout for AwaStream Sales`
        };

        // Transfer Endpoint: POST /v1/transfers/bank
        const response = await axios.post(`${BASE_URL}/transfers/bank`, payload, config);
        const responseBody = response.data;

        // Log the raw response for debugging
        console.log(`[Nomba Transfer] Response Code: ${responseBody.code}, Desc: ${responseBody.description}`);

        // FIX: Accept '00' OR 'Processing' description
        const isSuccessCode = responseBody.code === '00';
        const isProcessingDesc = responseBody.description && responseBody.description.toLowerCase() === 'processing';

        if (isSuccessCode || isProcessingDesc) {
            const nombaData = responseBody.data || {}; 
            const nombaStatus = nombaData.status || 'PROCESSING';
            
            let internalStatus = 'failed';
            
            if (nombaStatus === 'SUCCESS') {
                internalStatus = 'successful';
            } else if (nombaStatus === 'PROCESSING' || nombaStatus === 'PENDING' || isProcessingDesc) {
                internalStatus = 'pending';
            }

            // Fallback values if data object is missing (common in 'Processing' responses)
            return {
                reference: nombaData.meta?.rrn || nombaData.id || myTxRef, 
                status: internalStatus, 
                gateway_id: nombaData.id || myTxRef
            };
        } else {
            // Only throw if it's truly a failure (not 00 and not Processing)
            throw new Error(responseBody.description || "Transfer declined by Nomba.");
        }
    } catch (error) {
        console.error("Nomba Transfer Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || error.message || "Nomba failed to initiate transfer.");
    }
};


// --- 3. VERIFY PAYOUT STATUS (NEW: FIXES "STUCK IN PROCESSING") ---
const verifyTransfer = async (payoutId) => {
    try {
        const config = await getAuthHeaders();
        const merchantTxRef = `PAYOUT-${payoutId}`;
        
        // Endpoint: Fetch single transaction by merchant reference
        const response = await axios.get(
            `${BASE_URL}/transactions/accounts/single?merchantTxRef=${merchantTxRef}`,
            config
        );

        if (response.data.code === '00' && response.data.data) {
            const result = response.data.data;
            let status = 'pending';

            // Map Nomba statuses to AwaStream statuses
            const s = result.status;
            if (s === 'SUCCESS' || s === 'PAYMENT_SUCCESSFUL' || s === 'PAID') {
                status = 'successful';
            } else if (s === 'FAILED' || s === 'PAYMENT_FAILED' || s === 'REVERSED') {
                status = 'failed';
            }

            return {
                status: status,
                reference: result.rrn || result.id,
                gateway_id: result.id
            };
        }
        
        // If not found, it remains pending
        return { status: 'pending' };
    } catch (error) {
        console.error("Nomba Verify Transfer Error:", error.message);
        // Return pending on error so we can try again later
        return { status: 'pending' };
    }
};


const handleWebhook = async (req) => {
    const secret = process.env.NOMBA_CLIENT_SECRET; // Nomba uses Client Secret for signature
    const signature = req.headers['x-nomba-signature'];
    
    // 1. Security: Verify the request comes from Nomba
    if (process.env.NODE_ENV === 'production') {
        if (!signature) {
            throw new Error('No signature provided');
        }
        const hash = crypto.createHmac('sha512', secret)
            .update(JSON.stringify(req.body))
            .digest('hex');
        
        if (hash !== signature) {
            throw new Error('Invalid webhook signature');
        }
    }

    const payload = req.body;
    console.log(`[Nomba Webhook] Event Received: ${payload.type || 'Unknown'}`);

    // 2. Handle Payout Updates (Transfer to Creator)
    if (payload.type === 'transfer.success' || payload.type === 'transfer.failed') {
        const data = payload.data;
        const merchantRef = data.merchantTxRef; 

        if (merchantRef && merchantRef.startsWith('PAYOUT-')) {
            const payoutId = merchantRef.replace('PAYOUT-', '');
            const payout = await Payout.findById(payoutId);

            if (payout) {
                if (payload.type === 'transfer.success') {
                    // --- FIX: Standardized to 'successful' to match Initiate/Verify logic ---
                    payout.status = 'successful'; 
                    payout.processedAt = new Date();
                    console.log(`[Nomba Webhook] Payout ${payoutId} marked as SUCCESSFUL`);
                } else {
                    payout.status = 'failed';
                    payout.notes = data.message || "Transfer failed";
                    console.log(`[Nomba Webhook] Payout ${payoutId} marked as FAILED`);
                }
                await payout.save();
            }
        }
    }

    // 3. Handle Incoming Payment Updates (Checkout)
    if (payload.type === 'checkout.order.completed') {
        const data = payload.data;
        const internalRef = data.orderReference;

        const transaction = await Transaction.findOne({ internalRef });

        if (transaction && transaction.status === 'pending') {
            const paidAmount = parseFloat(data.amount);
            const expectedAmount = transaction.amountKobo / 100;

            if (paidAmount >= expectedAmount) {
                transaction.status = 'successful';
                transaction.providerRef = data.id;
                await transaction.save();
                console.log(`[Nomba Webhook] Transaction ${internalRef} marked as SUCCESSFUL`);
            }
        }
    }

    return true;
};


module.exports = {
    initialize,
    verify,
    verifyBankAccount,
    createTransferRecipient,
    initiateTransfer,
    getTransferAccount,
    verifyTransfer,
    getBankList,
    handleWebhook,
};