const axios = require('axios');

// Use Sandbox URL for development, Live for production
const BASE_URL = process.env.NODE_ENV === 'production' 
    ? 'https://api.nomba.com/v1' 
    : 'https://sandbox.nomba.com/v1';

let cachedToken = null;
let tokenExpiry = null;


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

        // Use fetch for auth as it proved more reliable than axios
        const fetchResponse = await fetch(`${BASE_URL}/auth/token/issue`, {
            method: 'POST',
            headers: authHeaders,
            body: JSON.stringify(authPayload)
        });

        const responseData = await fetchResponse.json();
        
        if (fetchResponse.ok && responseData.code === '00') {
            console.log("[Nomba Auth] Successfully fetched new token via fetch.");
            cachedToken = responseData.data.access_token;
            // Set expiry 5 minutes before actual expiry to be safe
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
            throw new Error(responseData.description || 'Failed to obtain Nomba access token');
        }
    } catch (error) {
        throw new Error("Could not authenticate with Nomba.");
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

        // axios.post worked fine, so we'll keep it
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
        
        // CRITICAL FIX: Create a copy of the headers and remove Content-Type for GET requests
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];

        // Use fetch for GET requests as it proved more reliable
        const fetchResponse = await fetch(`${BASE_URL}/transactions/accounts/single?orderReference=${orderReference}`, {
            method: 'GET',
            headers: getHeaders
        });
        const responseData = await fetchResponse.json();
        
        const data = responseData.data;

        // Check if the API call was good AND we have results
        if (responseData.code === '00' && data && data.results && data.results.length > 0) {
            
            const transaction = data.results[0];

            // Check the transaction's status
            if (transaction.status === 'SUCCESS') {
                return {
                    status: 'success',
                    amount: Math.round(parseFloat(transaction.amount) * 100),
                    reference: orderReference,
                    id: transaction.id 
                };
            } else {
                console.warn(`[Nomba Verify] Transaction found but status is: ${transaction.status}`);
                return { status: 'failed' };
            }

        } else {
            console.warn(`[Nomba Verify] Failed. API Code: ${responseData.code} or no results found.`);
            return { status: 'failed' };
        }

    } catch (error) {
        console.error("Nomba Verify Error:", error.message);
        throw new Error("Nomba payment verification failed.");
    }
};

const verifyBankAccount = async (accountNumber, bankCode) => {
    try {
        const config = await getAuthHeaders();
        // axios.post worked fine
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
        throw new Error(error.response?.data?.description || "Could not verify bank account details with Nomba.");
    }
};

const createTransferRecipient = async (creator) => {
    return "NOMBA_NO_RECIPIENT_NEEDED";
};

const getTransferAccount = async (orderReference) => {
    try {
        const config = await getAuthHeaders();

        // CRITICAL FIX: Remove Content-Type for GET requests
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];
        
        const fetchResponse = await fetch(
            `${BASE_URL}/checkout/get-checkout-kta/${orderReference}`, 
            {
                method: 'GET',
                headers: getHeaders
            }
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

// const initiateTransfer = async (amountKobo, recipientCode, payoutId, creatorDetails) => {
//     try {
//         const config = await getAuthHeaders();
        
//         const amountNaira = amountKobo / 100;

//         const payload = {
//             amount: amountNaira,
//             accountNumber: creatorDetails.payoutAccountNumber,
//             accountName: creatorDetails.payoutAccountName,
//             bankCode: creatorDetails.payoutBankName,
//             merchantTxRef: `PAYOUT-${payoutId}`,
//             senderName: "AwaStream Inc",
//             narration: `Payout for AwaStream Sales`
//         };

//         // axios.post worked fine
//         const response = await axios.post(`${BASE_URL}/transfers/bank`, payload, config);

//         if (response.data.code === '00') {
//              return {
//                 reference: response.data.data.meta.rrn || response.data.data.id,
//                 status: response.data.data.status,
//                 gateway_id: response.data.data.id
//             };
//         } else {
//              throw new Error(response.data.description || "Transfer declined");
//         }
//     } catch (error) {
//         console.error("Nomba Transfer Error:", error.response?.data || error.message);
//         throw new Error(error.response?.data?.description || "Nomba failed to initiate transfer.");
//     }
// };
const initiateTransfer = async (amountKobo, recipientCode, payoutId, creatorDetails) => {
    try {
        const config = await getAuthHeaders();
        
        // --- !! THIS IS THE FIX !! ---
        // 1. Get the bank list
        const bankList = await getBankList(); 
        
        // 2. Find the matching bank code from the creator's saved bank name
        // We use creatorDetails, which is the 'creator' object passed from the service
        const creatorBankName = creatorDetails.payoutBankName.toUpperCase();
        const matchingBank = bankList.find(bank => bank.name === creatorBankName);

        if (!matchingBank) {
            throw new Error(`Bank not found or name mismatch for: ${creatorDetails.payoutBankName}`);
        }
        // 3. Use the correct code
        const bankCodeToSend = matchingBank.code;
        // --- !! END OF FIX !! ---

        const amountNaira = amountKobo / 100;

        const payload = {
            amount: amountNaira,
            accountNumber: creatorDetails.payoutAccountNumber,
            accountName: creatorDetails.payoutAccountName,
            bankCode: bankCodeToSend, // <-- Now using the correct code
            merchantTxRef: `PAYOUT-${payoutId}`,
            senderName: "AwaStream Inc",
            narration: `Payout for AwaStream Sales`
        };

        // axios.post worked fine
        const response = await axios.post(`${BASE_URL}/transfers/bank`, payload, config);

        if (response.data.code === '00') {
             return {
                reference: response.data.data.meta.rrn || response.data.data.id,
                status: response.data.data.status,
                gateway_id: response.data.data.id
            };
        } else {
             throw new Error(response.data.description || "Transfer declined");
        }
    } catch (error) {
        // This will now pass up the "Bank not found" error
        console.error("Nomba Transfer Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || error.message || "Nomba failed to initiate transfer.");
    }
};
// A simple cache to avoid fetching the bank list repeatedly
let bankListCache = null;

const getBankList = async () => {
    if (bankListCache) {
        console.log("[Nomba Bank] Using cached bank list.");
        return bankListCache;
    }

    try {
        const config = await getAuthHeaders();
        
        // Since this is a GET request, we apply the fix: remove Content-Type
        const getHeaders = { ...config.headers };
        delete getHeaders['Content-Type'];

        // --- !! FIX: Changed /bank/list to /transfers/banks !! ---
        const fetchResponse = await fetch(`${BASE_URL}/transfers/banks`, {
            method: 'GET',
            headers: getHeaders
        });
        const responseData = await fetchResponse.json();
        // --- !! END OF FIX !! ---

        if (responseData.code === '00' && responseData.data) {
            console.log("[Nomba Bank] Successfully fetched new bank list.");
            bankListCache = responseData.data.map(bank => ({
                code: bank.code,
                name: bank.name.toUpperCase() // Nomba uses 'name' and 'code' fields
            }));
            return bankListCache;
        } else {
            console.log("[Nomba Bank] Failed to fetch list:", responseData);
            throw new Error(responseData.description || "Failed to fetch bank list.");
        }
    } catch (error) {
        console.error("Nomba getBankList Error:", error.message);
        throw new Error("Could not fetch bank list.");
    }
};

module.exports = {
    initialize,
    verify,
    verifyBankAccount,
    createTransferRecipient,
    initiateTransfer,
    getTransferAccount,
    getBankList
};