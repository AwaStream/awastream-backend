// middleware/rateLimiterMiddleware.js

const rateLimit = require('express-rate-limit');
// 1. Import the ipKeyGenerator helper
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
// 2. Import the redisClient from its correct file
const { redisClient } = require('../config/redisClient'); 
const logger = require('../config/logger');

// --- HELPER FUNCTION ---
const limitHandler = (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        user: req.user?._id,
        email: req.body?.email,
        limiter: options.prefix,
    });
    res.status(options.statusCode).send(options.message);
};

// --- Create Redis Stores ---
const authStore = new RedisStore({
    // FIX: Pass the arguments as a flat array using the spread operator
    sendCommand: (command, ...args) => redisClient.sendCommand([command, ...args]), 
    prefix: 'rl:auth',
});

const apiStore = new RedisStore({
    // FIX: Use the correct flat array signature
    sendCommand: (command, ...args) => redisClient.sendCommand([command, ...args]), 
    prefix: 'rl:api',
});

const userStore = new RedisStore({
    // FIX: Use the correct flat array signature
    sendCommand: (command, ...args) => redisClient.sendCommand([command, ...args]), 
    prefix: 'rl:user',
});

// --- 1. Brute-Force Limiter (Login, Register, Forgot Password) ---
const bruteForceLimiter = rateLimit({
    store: authStore,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, 
    standardHeaders: true,
    legacyHeaders: false,
    
    // --- THIS IS THE FIX for ERR_ERL_KEY_GEN_IPV6 ---
    keyGenerator: (req, res) => {
        const ip = ipKeyGenerator(req); // Use the helper
        const key = req.body.email ? `${req.body.email}:${ip}` : ip;
        return key;
    },
    // --- END OF FIX ---

    handler: (req, res, next, options) => {
        options.prefix = 'bruteForceLimiter';
        limitHandler(req, res, next, options);
    },
    message: {
        message: 'Too many attempts for this account. Please try again after 15 minutes.',
        code: 429
    },
});

// --- 2. General API Limiter (for anonymous users) ---
const apiLimiter = rateLimit({
    store: apiStore,
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        options.prefix = 'apiLimiter';
        limitHandler(req, res, next, options);
    },
    message: {
        message: 'Too many requests, please try again later.',
        code: 429
    },
});

// --- 3. Authenticated User Limiter ---
const userLimiter = rateLimit({
    store: userStore,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        if (req.user) {
            return req.user._id.toString();
        }
        return ipKeyGenerator(req); // Also use helper here
    },
    handler: (req, res, next, options) => {
        options.prefix = 'userLimiter';
        limitHandler(req, res, next, options);
    },
    message: {
        message: 'You have exceeded your request quota. Please wait 15 minutes before trying again.',
        code: 429
    },
});

// --- 4. EXPORT ---
module.exports = {
    bruteForceLimiter,
    apiLimiter,
    userLimiter,
};