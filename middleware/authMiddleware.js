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
            
            req.user = await User.findById(decoded.id).select('-passwordHash');

            if (!req.user) {
                 res.status(401);
                 throw new Error('Not authorized, user not found for this token');
            }
            next();
        } catch (error) {
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, token failed or is invalid');
        }
    }

    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }
});

const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403); // 403 Forbidden
            throw new Error(`Forbidden: You do not have the required '${roles.join(' or ')}' role.`);
        }
        next();
    };
};

module.exports = { authenticate, authorize };