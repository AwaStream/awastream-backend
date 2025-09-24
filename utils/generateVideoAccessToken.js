const jwt = require('jsonwebtoken');

/**
 * @desc    Generates a short-lived JWT specifically for accessing a video stream.
 * @param   {object} user - The authenticated user object (from req.user).
 * @param   {object} video - The video document the user is trying to access.
 * @returns {string} - The signed, short-lived JWT.
 */
const generateVideoAccessToken = (user, video) => {
    // 1. The Payload: Information we want to securely store in the token.
    // This proves which user has access to which video.
    const payload = {
        userId: user._id,
        videoId: video._id,
        sourceType: video.sourceType,
    };

    // 2. The Options: We set a very short expiry time for security.
    const options = {
        expiresIn: '5m', // The token will be invalid after 5 minutes
    };

    // 3. The Signature: We sign the token with our secret key from the .env file.
    // This ensures the token is authentic and hasn't been tampered with.
    if (!process.env.JWT_SECRET) {
        throw new Error('JWT_SECRET is not defined in environment variables.');
    }
    return jwt.sign(payload, process.env.JWT_SECRET, options);
};

module.exports = {
    generateVideoAccessToken,
};