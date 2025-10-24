// const { createClient } = require('redis');
// const logger = require('./logger');

// // Create the client, but DO NOT connect yet
// const redisClient = createClient({
//     url: process.env.REDIS_URL,
// });

// // Set up listeners
// redisClient.on('error', (err) => {
//     logger.error('Redis Client Error', { 
//         code: err.code || 'UNKNOWN',
//         message: err.message,
//     });
// });

// redisClient.on('connect', () => {
//     logger.info('Connected to Redis server');
// });

// redisClient.on('reconnecting', () => {
//     logger.warn('Reconnecting to Redis...');
// });

// // Create an async function to be called from server.js
// const connectRedis = async () => {
//     try {
//         await redisClient.connect();
//     } catch (err) {
//         logger.error('Failed to connect to Redis on startup.', { 
//             errorName: err.name,
//         });
//         // Exit the process if Redis connection fails on startup
//         process.exit(1); 
//     }
// };

// // Export ONLY these two
// module.exports = { redisClient, connectRedis };