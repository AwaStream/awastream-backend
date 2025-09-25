// const express = require('express');
// const passport = require('passport');
// const router = express.Router();

// // --- Removed 'googleAuth' from the import as it doesn't exist ---
// const { registerUser, loginUser, getMe, googleCallback, logoutUser, refreshToken } = require('../controllers/authController');
// const { authenticate } = require('../middleware/authMiddleware');

// router.post('/register', registerUser);
// router.post('/login', loginUser);

// router.get('/google', (req, res, next) => {
//     // Get the 'intent' from the query parameter (e.g., ?intent=viewer)
//     const { intent } = req.query;
//     // Save the intent to the session before starting the Passport flow
//     req.session.intent = intent;
//     passport.authenticate('google', { 
//         scope: ['profile', 'email'],
//     })(req, res, next);
// });

// router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);

// router.get('/me', authenticate, getMe);
// router.post('/refresh-token', refreshToken);
// router.post('/logout', authenticate, logoutUser);

// module.exports = router;




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