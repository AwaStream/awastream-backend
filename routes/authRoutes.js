const express = require('express');
const passport = require('passport');
const { userLimiter, authLimiter } = require('../middleware/rateLimiterMiddleware');
const router = express.Router();

// --- Import ALL your controllers ---
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

// --- Import ALL your validators ---
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

// --- Import auth middleware ---
const { authenticate } = require('../middleware/authMiddleware');

// --- Standard Auth Routes ---
router.post('/register', authLimiter, validateRegister, registerUser);
router.post('/login', authLimiter, validateLogin, loginUser);
router.post('/logout', authenticate, userLimiter, logoutUser);
router.post('/refresh-token', authLimiter, refreshToken); // No validator needed, reads cookie
router.get('/me', authenticate, userLimiter, getMe);

// --- Google OAuth Routes ---
router.get(
    '/google',
    authLimiter,
    validateGoogleAuth, 
    (req, res, next) => {
        const { intent } = req.query;
        req.session.intent = intent;
        passport.authenticate('google', {
            scope: ['profile', 'email'],
        })(req, res, next);
    }
);

router.get(
    '/google/callback',
    authLimiter,
    passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
    googleCallback
);

// --- Email Verification Routes ---
router.post('/verify-email', authLimiter, validateVerifyEmail, verifyEmail);
router.post('/resend-verification', authLimiter, validateResendVerificationEmail, resendVerificationEmail);

// --- Password Reset Routes ---
router.post('/forgot-password', authLimiter, validateForgotPassword, forgotPassword);
router.put('/reset-password', authLimiter, validateResetPassword, resetPassword);
router.put(
    '/change-password',
    authenticate,   
    userLimiter,        
    validateChangePassword, 
    changePassword 
);

module.exports = router;