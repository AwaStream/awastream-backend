const express = require('express');
const passport = require('passport');
const { userLimiter, authLimiter } = require('../middleware/rateLimiterMiddleware');
const router = express.Router();

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
    resetPassword
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

// --- Standard Auth Routes ---
router.post('/register', authLimiter, registerUser);
router.post('/login', authLimiter, loginUser);
router.get('/me', authenticate, userLimiter, getMe);
router.post('/logout', authenticate, userLimiter, logoutUser);
router.post('/refresh-token', refreshToken);

// --- Google OAuth Routes ---
router.get('/google', (req, res, next) => {
    const { intent } = req.query;
    req.session.intent = intent;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
    })(req, res, next);
});

router.get('/google/callback', authLimiter, passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);

// --- Email Verification Routes ---
router.post('/verify-email', authLimiter, verifyEmail);
router.post('/resend-verification', authLimiter, resendVerificationEmail);

// --- Password Reset Routes ---
router.post('/forgot-password', authLimiter, forgotPassword);
router.put('/reset-password',authLimiter, resetPassword);

module.exports = router;