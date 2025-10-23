const rateLimit = require('express-rate-limit');
// 1. Import the ipKeyGenerator helper
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const redisClient = require('../config/redisClient');

// 2. Create THREE separate store instances, each with a unique prefix.
const authStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth', // Unique prefix for auth
});

const apiStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:api', // Unique prefix for general API
});

const userStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:user', // Unique prefix for authenticated users
});

// 1. STRICT/BRUTE-FORCE Limiter
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many requests from this IP. Please try again after 15 minutes.',
        code: 429
    },
    store: authStore, // <-- Use the unique authStore
});

// 2. GENERAL API Limiter
const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        message: 'Too many requests, please try again later.',
        code: 429
    },
    store: apiStore, // <-- Use the unique apiStore
});

// 3. AUTHENTICATED/USER-BASED Limiter
const userLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // 3. Use the ipKeyGenerator helper for unauthenticated requests
        return req.user ? req.user._id.toString() : ipKeyGenerator(req);
    },
    message: {
        message: 'You have exceeded your request quota. Please try again in 15 minutes.',
        code: 429
    },
    store: userStore, // <-- Use the unique userStore
});

module.exports = {
    authLimiter,
    apiLimiter,
    userLimiter,
};