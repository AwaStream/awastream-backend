const { createClient } = require('redis');
const logger = require('./logger');

// Create the client
const redisClient = createClient({
    url: process.env.REDIS_URL,
});

redisClient.on('error', (err) => {
    logger.error('Redis Client Error: Connection failed or command execution error.', { 
        code: err.code || 'UNKNOWN',
        message: err.message,
    });
});

redisClient.on('connect', () => {
    logger.info('Connected to Redis server');
});

(async () => {
    try {
        await redisClient.connect();
    } catch (err) {
        logger.error('Failed to connect to Redis, check REDIS_URL configuration.', { 
            errorName: err.name,
        });
    }
})();

module.exports = redisClient;