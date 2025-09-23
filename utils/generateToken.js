const jwt = require('jsonwebtoken');

/**
 * Generates a JSON Web Token for a user.
 * @param {string} userId - The user's MongoDB ObjectId.
 * @param {string} role - The user's role (e.g., 'creator', 'superadmin').
 * @returns {string} - The signed JWT.
 */
const generateToken = (userId, role) => {
    const payload = {
        userId,
        role,
    };

    // This now correctly reads the JWT_EXPIRY variable from your .env file
    const expiresIn = process.env.JWT_EXPIRY || '30d';

    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in the environment variables.');
    }

    return jwt.sign(payload, process.env.JWT_SECRET, {
        expiresIn: expiresIn,
    });
};

module.exports = generateToken;