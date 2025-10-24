const jwt = require('jsonwebtoken');

/**
 * Generates an access token and a refresh token for a user.
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'creator').
 * @returns {{accessToken: string, refreshToken: string}} - An object containing both tokens.
 */

const generateTokens = (userId, role) => {
    if (!process.env.JWT_ACCESS_SECRET || !process.env.JWT_REFRESH_SECRET) {
        throw new Error('JWT secrets are not defined in the environment variables.');
    }

    // 1. Payload for short-lived ACCESS token (contains permissions)
    const accessPayload = {
        id: userId,
        role,
    };

    // 2. Payload for long-lived REFRESH token (contains ONLY identity)
    const refreshPayload = {
        id: userId,
    };

    // 3. Sign with different secrets
    const accessToken = jwt.sign(accessPayload, process.env.JWT_ACCESS_SECRET, {
        expiresIn: process.env.JWT_ACCESS_EXPIRY || '15m',
    });

    const refreshToken = jwt.sign(refreshPayload, process.env.JWT_REFRESH_SECRET, {
        expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d',
    });

    return { accessToken, refreshToken };
};

module.exports = generateTokens;