const jwt = require('jsonwebtoken');

/**
 * Generates an access token and a refresh token for a user.
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'creator').
 * @returns {{accessToken: string, refreshToken: string}} - An object containing both tokens.
 */
const generateTokens = (userId, role) => {
    // 1. Check for required environment variables
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }

    // 2. Define the payload for the tokens
    const payload = {
        id: userId, // Use 'id' for consistency with JWT standards
        role,
    };

    // 3. Create the short-lived access token
    // It uses the JWT_ACCESS_EXPIRY variable (e.g., "15m")
    const accessToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });

    // 4. Create the long-lived refresh token
    // It uses the JWT_REFRESH_EXPIRY variable (e.g., "7d")
    const refreshToken = jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });

    // 5. Return both tokens in an object
    return { accessToken, refreshToken };
};

module.exports = generateTokens;