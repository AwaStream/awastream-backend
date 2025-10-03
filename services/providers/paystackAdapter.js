const axios = require('axios');
const crypto = require('crypto');
const Transaction = require('../../models/Transaction');
const Video = require('../../models/Video');
const Bundle = require('../../models/Bundle');
const User = require('../../models/User');
const Notification = require('../../models/Notification');
const { COMMISSION_RATE } = require('../../config/constants');

const paystackClient = axios.create({
    baseURL: 'https://api.paystack.co',
    headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        'Content-Type': 'application/json'
    }
});

const initialize = async (email, amountKobo, reference, productDetails) => {
    if (!process.env.PAYSTACK_SECRET_KEY) {
        throw new Error("PAYSTACK_SECRET_KEY is not set.");
    }

    // Construct the URL to redirect the user to after payment
    const callback_url = `${process.env.CLIENT_URL}/view/${productDetails.productType.toLowerCase()}/${productDetails.slug}?payment=successful`;
    
    try {
        const response = await paystackClient.post('/transaction/initialize', {
            email,
            amount: amountKobo,
            reference,
            callback_url,
            // Pass all custom data inside the 'metadata' object
            metadata: {
                internalRef: reference,
                productSlug: productDetails.slug,
                productType: productDetails.productType,
            }
        });
        return response.data.data;
    } catch (error) {
        console.error("Paystack Initialization Error:", error.response?.data);
        throw new Error("Payment provider could not be reached or has rejected the request.");
    }
};

const verify = async (reference) => {
    try {
        const response = await paystackClient.get(`/transaction/verify/${reference}`);
        return response.data.data;
    } catch (error) {
        throw new Error("Could not verify payment with provider.");
    }
};

const handleWebhook = async (req) => {
    const secret = process.env.PAYSTACK_WEBHOOK_SECRET;
    const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) {
        throw new Error("Invalid webhook signature.");
    }
    
    const { event, data } = req.body;

    if (event === 'charge.success') {
        const internalRef = data.reference;
        const transaction = await Transaction.findOne({ internalRef });

        if (transaction && transaction.status === 'pending') {
            const grossAmountKobo = data.amount;
            const commissionKobo = Math.round(grossAmountKobo * COMMISSION_RATE);
            const creatorEarningsKobo = grossAmountKobo - commissionKobo;

            transaction.status = 'successful';
            transaction.providerRef = data.id.toString();
            transaction.commissionKobo = commissionKobo;
            transaction.creatorEarningsKobo = creatorEarningsKobo;
            
            await transaction.save();

            // Increment the sales counter for the correct product type
            if (transaction.productType === 'Video') {
                await Video.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
            } else if (transaction.productType === 'Bundle') {
                await Bundle.findByIdAndUpdate(transaction.product, { $inc: { totalSales: 1 } });
            }

             try {
                const [buyer, product] = await Promise.all([
                    User.findById(transaction.user).lean(),
                    transaction.productType === 'Video' 
                        ? Video.findById(transaction.product).lean() 
                        : Bundle.findById(transaction.product).lean()
                ]);

                if (buyer && product) {
                    await Notification.create({
                        user: transaction.creator, // The creator gets the notification
                        type: 'new_sale',
                        message: `${buyer.firstName} purchased your ${transaction.productType.toLowerCase()}: "${product.title}"`,
                        link: `/${transaction.productType.toLowerCase()}s/${product.shareableSlug}`
                    });
                }
            } catch (notificationError) {
                console.error("Failed to create sale notification from Paystack webhook:", notificationError);
            }
        }
    }
};

module.exports = { 
    initialize, 
    verify,
    handleWebhook,
};