const express = require('express');
const passport = require('passport');
const router = express.Router();
const { registerUser, loginUser, getMe, googleAuth, googleCallback, logoutUser } = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');

router.post('/register', registerUser);
router.post('/login', loginUser);
router.get('/google', googleAuth);
router.get('/google/callback', passport.authenticate('google', { failureRedirect: '/login/failed', session: false }), googleCallback);
router.get('/me', authenticate, getMe);
router.post('/logout', authenticate, logoutUser);

module.exports = router;