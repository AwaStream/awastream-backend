const rateLimit = require('express-rate-limit');

// 💡 ADVICE FOR REDIS:
// If you switch to Redis, you would only need to update the imports 
// and the 'store' property in this file, NOT your main server file.
// const RedisStore = require('rate-limit-redis'); 

// 1. STRICT/BRUTE-FORCE Limiter (Login, Register, Forgot Password)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    standardHeaders: true, 
    legacyHeaders: false,
    message: {
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
        code: 429
    },
    // store: new RedisStore({ client: redisClient }), // Example Redis integration
});

// 2. GENERAL API Limiter (Most API routes)
const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 1000, // Limit each IP to 1000 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many requests, please try again later.',
        code: 429
    },
});

// 3. AUTHENTICATED/USER-BASED Limiter (For protected routes)
const userLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // 500 requests per 15 minutes per USER
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // Essential for user-based limiting: uses req.user._id if authenticated
        return req.user ? req.user._id.toString() : req.ip; 
    },
    message: {
        message: 'You have exceeded your request quota. Please try again in 15 minutes.',
        code: 429
    },
});

module.exports = {
    authLimiter,
    apiLimiter,
    userLimiter,
};