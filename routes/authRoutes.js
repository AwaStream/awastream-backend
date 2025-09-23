const express = require('express');
const passport = require('passport');
const router = express.Router();

// --- Removed 'googleAuth' from the import as it doesn't exist ---
const { registerUser, loginUser, getMe, googleCallback, logoutUser, refreshToken } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);

router.get('/google', passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false 
}));

router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);

router.get('/me', authenticate, getMe);
router.post('/refresh-token', refreshToken);
router.post('/logout', authenticate, logoutUser);

module.exports = router;