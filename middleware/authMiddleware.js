const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// Middleware to verify the JWT and attach the user to the request object.
const authenticate = asyncHandler(async (req, res, next) => {
    let token;
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer')) {
        try {
            token = authHeader.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.userId).select('-passwordHash');

            if (!req.user) {
                 res.status(401);
                 throw new Error('Not authorized, user not found');
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, token failed');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }
});

// Middleware factory to check for specific roles.
// Usage: authorize('superadmin') or authorize('creator', 'superadmin')
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403); // 403 Forbidden - you are logged in, but you don't have permission
            throw new Error(`Forbidden: User role '${req.user.role}' is not authorized to access this route.`);
        }
        next();
    };
};

module.exports = { authenticate, authorize };