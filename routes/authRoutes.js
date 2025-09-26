const express = require('express');
const passport = require('passport');
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
router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logoutUser);
router.post('/refresh-token', refreshToken);

// --- Google OAuth Routes ---
router.get('/google', (req, res, next) => {
    const { intent } = req.query;
    req.session.intent = intent;
    passport.authenticate('google', {
        scope: ['profile', 'email'],
    })(req, res, next);
});

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);

// --- Email Verification Routes ---
router.post('/verify-email', verifyEmail);
router.post('/resend-verification', resendVerificationEmail);

// --- Password Reset Routes ---
router.post('/forgot-password', forgotPassword);
router.put('/reset-password', resetPassword);

module.exports = router;