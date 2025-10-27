const express = require('express');
const passport = require('passport');

// const { 
//     userLimiter, 
//     bruteForceLimiter, 
//     apiLimiter 
// } = require('../middleware/rateLimiterMiddleware');

const router = express.Router();

// --- Import ALL your controllers (No change) ---
const {
    registerUser,
    loginUser,
    getMe,
    googleCallback,
    logoutUser,
    refreshToken,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
    changePassword, 
} = require('../controllers/authController');

// --- Import ALL your validators (No change) ---
const {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateVerifyEmail,
    validateResendVerificationEmail,
    validateGoogleAuth,
    validateChangePassword,
} = require('../middleware/validation/authValidator');

const {authLimiter} = require('../middleware/rateLimiters')
// --- Import auth middleware (No change) ---
const { authenticate } = require('../middleware/authMiddleware');

// --- Standard Auth Routes ---
router.post('/register', validateRegister, authLimiter, registerUser);

router.post('/login', validateLogin, authLimiter, loginUser);

// CORRECT (Already good): Authenticated routes use
router.post('/logout', authenticate, logoutUser);

// FIX: Use the more lenient 
// This route is called by the frontend interceptor and MUST NOT be strict.
router.post('/refresh-token',  refreshToken); 

// CORRECT (Already good): Authenticated routes use 
router.get('/me', authenticate, getMe);

// --- Google OAuth Routes ---

router.get(
    '/google',
    validateGoogleAuth, 
    (req, res, next) => {
        const { intent } = req.query;
        req.session.intent = intent;
        passport.authenticate('google', {
            scope: ['profile', 'email'],
        })(req, res, next);
    }
);

// FIX: Use the lenient
router.get(
    '/google/callback',
    passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
    googleCallback
);

// --- Email Verification Routes ---

// FIX: Use the lenient api instead of the old
router.post('/verify-email',  validateVerifyEmail, verifyEmail);

// FIX: Use the lenient api instead of the ol
router.post('/resend-verification', validateResendVerificationEmail, authLimiter, resendVerificationEmail);

// --- Password Reset Routes ---
router.post('/forgot-password',  validateForgotPassword, authLimiter, forgotPassword);

router.put('/reset-password', validateResetPassword, resetPassword);

// CORRECT (Already good): Authenticated routes use 
router.put(
    '/change-password',
    authenticate,       
    validateChangePassword, 
    changePassword 
);

module.exports = router;