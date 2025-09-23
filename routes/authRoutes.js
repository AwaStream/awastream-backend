const express = require('express');
const passport = require('passport');
const router = express.Router();

// --- Removed 'googleAuth' from the import as it doesn't exist ---
const { registerUser, loginUser, getMe, googleCallback, logoutUser, refreshToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/google', (req, res, next) => {
    // Get the 'intent' from the query parameter (e.g., ?intent=viewer)
    const { intent } = req.query;
    // Save the intent to the session before starting the Passport flow
    req.session.intent = intent;
    passport.authenticate('google', { 
        scope: ['profile', 'email'],
    })(req, res, next);
});

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);

router.get('/me', authenticate, getMe);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logoutUser);

module.exports = router;