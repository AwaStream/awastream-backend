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
    try {
        // --- !! NEW LOGGING !! ---
        console.log(`[Nomba Auth] Requesting token from: ${BASE_URL}/auth/token/issue`);
        console.log(`[Nomba Auth] Using accountId: ${process.env.NOMBA_ACCOUNT_ID}`);
        console.log(`[Nomba Auth] Using client_id: ${process.env.NOMBA_CLIENT_ID}`);

        const authPayload = {
            grant_type: 'client_credentials',
            client_id: process.env.NOMBA_CLIENT_ID,
            client_secret: process.env.NOMBA_CLIENT_SECRET
        };

        const authHeaders = {
            headers: {
                'accountId': process.env.NOMBA_ACCOUNT_ID,
                'Content-Type': 'application/json'
            }
        };

        // IMPORTANT: Notice the '/issue' endpoint we found in testings
        const response = await axios.post(`${BASE_URL}/auth/token/issue`, authPayload, authHeaders);

        if (response.data.code === '00') {
            cachedToken = response.data.data.access_token;
            // Set expiry 5 minutes before actual expiry to be safe
            const expiresInSeconds = response.data.data.expires_in || 3600;
            tokenExpiry = new Date(new Date().getTime() + (expiresInSeconds - 300) * 1000);
            
            return {
                headers: {
                    'Authorization': `Bearer ${cachedToken}`,
                    'accountId': process.env.NOMBA_ACCOUNT_ID,
                    'Content-Type': 'application/json'
                }
            };
        } else {
            throw new Error('Failed to obtain Nomba access token');
        }
    } catch (error) {
        console.error("Nomba Auth Error:", error.response?.data || error.message);
        throw new Error("Could not authenticate with Nomba.");
    }
};



const initialize = async (email, amountKobo, internalRef, productDetails) => {
    try {
        const config = await getAuthHeaders();
        
        // Convert Kobo to Naira for Nomba
        const amountNaira = (amountKobo / 100).toFixed(2);

        // Construct the URL to redirect the user to after payment
        // Matches the logic in your paystackAdapter
        const callbackUrl = `${process.env.CLIENT_URL}/view/${productDetails.productType.toLowerCase()}/${productDetails.slug}?payment=successful`;

        const payload = {
            order: {
                orderReference: internalRef,
                customerId: email, // Using email as customer ID for simplicity
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
                // Return the key Paystack uses so the controller doesn't need to change
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
        
        console.log(`[Nomba Verify] Checking reference: ${orderReference}`);
        const response = await axios.get(`${BASE_URL}/checkout/order/verify?orderReference=${orderReference}`, config);

        // --- !! NEW LOGGING !! ---
        // Log the full response data from Nomba
        console.log('[Nomba Verify] Full response:', JSON.stringify(response.data, null, 2));
        
        const data = response.data.data;

        if (response.data.code === '00' && data.status === 'PAID') {
            return {
                status: 'success',
                amount: Math.round(parseFloat(data.amount) * 100),
                reference: orderReference,
                id: data.id 
            };
        } else {
            // Log the reason it failed
            console.log(`[Nomba Verify] Failed. Code: ${response.data.code}, Status: ${data?.status}`);
            return {
                status: 'failed'
            };
        }
    } catch (error) {
        console.error("Nomba Verify Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || "Nomba payment verification failed.");
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
        throw new Error(error.response?.data?.description || "Could not verify bank account details with Nomba.");
    }
};

// Nomba doesn't use "Recipient Codes" like Paystack, so this is a no-op pass-through
const createTransferRecipient = async (creator) => {
    return "NOMBA_NO_RECIPIENT_NEEDED";
};

const getTransferAccount = async (orderReference) => {
    try {
        const config = await getAuthHeaders();
        
        const response = await axios.get(
            `${BASE_URL}/checkout/get-checkout-kta/${orderReference}`, 
            config
        );

        if (response.data.code === '00') {
            return response.data.data; // This contains accountName, accountNumber, etc.
        } else {
            throw new Error(response.data.description || "Failed to get transfer account");
        }
    } catch (error) {
        console.error("Nomba getTransferAccount Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || "Could not get bank transfer details.");
    }
};

const initiateTransfer = async (amountKobo, recipientCode, payoutId, creatorDetails) => {
    try {
        const config = await getAuthHeaders();
        
        // Convert Kobo to Naira for Nomba
        const amountNaira = amountKobo / 100;

        const payload = {
            amount: amountNaira,
            accountNumber: creatorDetails.payoutAccountNumber,
            accountName: creatorDetails.payoutAccountName,
            bankCode: creatorDetails.payoutBankName, // Assuming this field holds the bank code (e.g., "058")
            merchantTxRef: `PAYOUT-${payoutId}`,
            senderName: "AwaStream Inc", // Customized for your business
            narration: `Payout for AwaStream Sales`
        };

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
        console.error("Nomba Transfer Error:", error.response?.data || error.message);
        throw new Error(error.response?.data?.description || "Nomba failed to initiate transfer.");
    }
};

module.exports = {
    initialize,
    verify,
    verifyBankAccount,
    createTransferRecipient,
    initiateTransfer,
    getTransferAccount
};