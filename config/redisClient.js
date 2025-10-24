// const { createClient } = require('redis');
// const logger = require('./logger');

// // Create the client, but DO NOT connect yet
// const redisClient = createClient({
//     url: process.env.REDIS_URL,
// });

// // Set up listeners
// redisClient.on('error', (err) => {
//     logger.error('Redis Client Error', { 
//         code: err.code || 'UNKNOWN',
//         message: err.message,
//     });
// });

// redisClient.on('connect', () => {
//     logger.info('Connected to Redis server');
// });

// redisClient.on('reconnecting', () => {
//     logger.warn('Reconnecting to Redis...');
// });

// // Create an async function to be called from server.js
// const connectRedis = async () => {
//     try {
//         await redisClient.connect();
//     } catch (err) {
//         logger.error('Failed to connect to Redis on startup.', { 
//             errorName: err.name,
//         });
//         // Exit the process if Redis
//         process.exit(1); 
//     }
// };

// module.exports = { redisClient, connectRedis };



const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { RedisStore } = require('rate-limit-redis');
const { redisClient } = require('../config/redisClient');
const logger = require('../config/logger'); // Import your logger

// --- Create Redis Stores (Your setup is perfect) ---
const authStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth',
});

const apiStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:api',
});

const userStore = new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:user',
});

// --- HELPER FUNCTION ---
// Custom handler to log when a limit is reached
const limitHandler = (req, res, next, options) => {
    logger.warn('Rate limit exceeded', {
        ip: req.ip,
        path: req.path,
        user: req.user?._id,
        email: req.body?.email,
        limiter: options.prefix, // We will add a prefix to each limiter's config
    });
    // Use the message from the specific limiter that was triggered
    res.status(options.statusCode).send(options.message);
};

// --- 1. NEW: Brute-Force Limiter (Login, Register, Forgot Password) ---
// This is strict, but targets the USER, not just the IP.
const bruteForceLimiter = rateLimit({
    store: authStore,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 attempts
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // Key by a combination of the email (if provided) and the IP
        // This stops one IP from brute-forcing 1000 emails
        // And stops one email from being brute-forced from 1000 IPs
        const key = req.body.email ? `${req.body.email}:${req.ip}` : req.ip;
        return key;
    },
    handler: (req, res, next, options) => {
        options.prefix = 'bruteForceLimiter'; // Add context for the logger
        limitHandler(req, res, next, options);
    },
    message: {
        message: 'Too many attempts for this account. Please try again after 15 minutes.',
        code: 429
    },
});

// --- 2. MODIFIED: General API Limiter (for anonymous users) ---
// Was: max: 1000 / 1 hour (Too strict)
// Now: max: 300 / 1 minute (Much more reasonable for browsing)
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

const userLimiter = rateLimit({
    store: userStore,
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 2000,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => {
        // This is perfect, key by user ID if they are logged in
        if (req.user) {
            return req.user._id.toString();
        }
        // Fallback to IP if something goes wrong
        return ipKeyGenerator(req);
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

module.exports = {
    bruteForceLimiter,
    apiLimiter,
    userLimiter,
};