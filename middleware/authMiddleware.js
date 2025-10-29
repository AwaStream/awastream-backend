const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// Middleware to verify the JWT and attach the user to the request object.
const authenticate = asyncHandler(async (req, res, next) => {
    let token;

    // 1. Check for token in cookie (primary method)
    if (req.cookies.accessToken) { 
        token = req.cookies.accessToken;
    } 
    // 2. Fallback check for the Bearer header (less common, but good to keep)
    else if (req.headers.authorization?.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];
    }
    
    // Check if a token was found (either in cookie or header)
    if (token) { 
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            
            // 🚨 FIX: Select 'isEmailVerified' from the database
            const user = await User.findById(decoded.id).select('_id role status isEmailVerified email'); 

            if (!user || user.status !== 'active') {
                res.status(401);
                throw new Error('User not found or account is inactive.');
            }
            
            // 🚨 CRITICAL FIX: Block access if the email is not verified
            if (!user.isEmailVerified) {
                res.status(403); // 403 Forbidden: Authorized, but access to this resource is denied
                throw new Error('Access denied. Please verify your email address to continue.');
            }
            
            req.user = user; 
            next();

        } catch (error) {
            // This catch block correctly handles expired or invalid tokens
            console.error(error);
            res.status(401);
            throw new Error('Not authorized, token failed or is invalid');
        }
    } else {
        res.status(401);
        throw new Error('Not authorized, no token provided');
    }
});

// This function works perfectly with the new stateless model
const authorize = (...roles) => {
    return (req, res, next) => {
        // It now reads 'req.user.role' from the token payload, not from the DB.
        if (!req.user || !roles.includes(req.user.role)) {
            res.status(403); // 403 Forbidden
            throw new Error(`Forbidden: You do not have the required '${roles.join(' or ')}' role.`);
        }
        next();
    };
};

module.exports = { authenticate, authorize };