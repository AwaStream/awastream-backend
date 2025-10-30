const rateLimit = require('express-rate-limit');

// 1. Strict Limiter for Public Auth Endpoints (Brute Force Protection)
const authLimiter = rateLimit({
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 5, // Limit each IP to 5 requests per windowMs
    standardHeaders: true, 
    legacyHeaders: false, 
    message: {
        status: 429,
        message: 'Too many login/registration attempts. Please try again after 5 minutes.',
    },
    // Handler will be used later if we want custom UI error messages
});

// 2. Global API Limiter (General DoS Protection)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 500, // Limit each IP to 100 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        status: 429,
        message: 'Rate limit exceeded. Too many general requests, please slow down.',
    },
});

module.exports = { authLimiter, globalLimiter };