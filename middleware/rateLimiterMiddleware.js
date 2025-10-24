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
    windowMs: 5 * 60 * 1000,
    max: 10,
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
        if (req.user) {
            return req.user._id.toString();
        }
        return ipKeyGenerator(req);
    },
    message: {
        message: 'You have exceeded your request quota. Please wait 5 minutes before trying again.',
        code: 429
    },
    store: userStore,
});

module.exports = {
    authLimiter,
    apiLimiter,
    userLimiter,
};