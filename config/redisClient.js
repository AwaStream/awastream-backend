const { createClient } = require('redis');
const logger = require('./logger');

// Create the client
const redisClient = createClient({
    // Your .env file must have a REDIS_URL
    // e.g., REDIS_URL=redis://localhost:6379
    // Production providers (like Render, AWS) will give you this URL.
    url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error', err);
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis server');
});

// We must connect the client.
// We use an async IIFE to connect on app startup.
(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        logger.error('Failed to connect to Redis:', err);
    }
})();

module.exports = redisClient;