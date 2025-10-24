// const express = require('express');
// const passport = require('passport');
// const { userLimiter, authLimiter } = require('../middleware/rateLimiterMiddleware');
// const router = express.Router();

// // --- Import ALL your controllers ---
// const {
//     registerUser,
//     loginUser,
//     getMe,
//     googleCallback,
//     logoutUser,
//     refreshToken,
//     verifyEmail,
//     resendVerificationEmail,
//     forgotPassword,
//     resetPassword,
//     changePassword, 
// } = require('../controllers/authController');

// // --- Import ALL your validators ---
// const {
//     validateRegister,
//     validateLogin,
//     validateForgotPassword,
//     validateResetPassword,
//     validateVerifyEmail,
//     validateResendVerificationEmail,
//     validateGoogleAuth,
//     validateChangePassword,
// } = require('../middleware/validation/authValidator');

// // --- Import auth middleware ---
// const { authenticate } = require('../middleware/authMiddleware');

// // --- Standard Auth Routes ---
// router.post('/register', authLimiter, validateRegister, registerUser);
// router.post('/login', authLimiter, validateLogin, loginUser);
// router.post('/logout', authenticate, userLimiter, logoutUser);
// router.post('/refresh-token', authLimiter, refreshToken); // No validator needed, reads cookie
// router.get('/me', authenticate, userLimiter, getMe);

// // --- Google OAuth Routes ---
// router.get(
//     '/google',
//     authLimiter,
//     validateGoogleAuth, 
//     (req, res, next) => {
//         const { intent } = req.query;
//         req.session.intent = intent;
//         passport.authenticate('google', {
//             scope: ['profile', 'email'],
//         })(req, res, next);
//     }
// );

// router.get(
//     '/google/callback',
//     authLimiter,
//     passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
//     googleCallback
// );

// // --- Email Verification Routes ---
// router.post('/verify-email', authLimiter, validateVerifyEmail, verifyEmail);
// router.post('/resend-verification', authLimiter, validateResendVerificationEmail, resendVerificationEmail);

// // --- Password Reset Routes ---
// router.post('/forgot-password', authLimiter, validateForgotPassword, forgotPassword);
// router.put('/reset-password', authLimiter, validateResetPassword, resetPassword);
// router.put(
//     '/change-password',
//     authenticate,   
//     userLimiter,        
//     validateChangePassword, 
//     changePassword 
// );

// module.exports = router;








const express = require('express');
const passport = require('passport');

const { 
    userLimiter, 
    bruteForceLimiter, 
    apiLimiter 
} = require('../middleware/rateLimiterMiddleware');

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

// --- Import auth middleware (No change) ---
const { authenticate } = require('../middleware/authMiddleware');

// --- Standard Auth Routes ---

// FIX: Use the NEW bruteForceLimiter (keyed by email + IP)
router.post('/register', bruteForceLimiter, validateRegister, registerUser);

// FIX: Use the NEW bruteForceLimiter (keyed by email + IP)
router.post('/login', bruteForceLimiter, validateLogin, loginUser);

// CORRECT (Already good): Authenticated routes use userLimiter
router.post('/logout', authenticate, userLimiter, logoutUser);

// FIX: Use the more lenient apiLimiter. 
// This route is called by the frontend interceptor and MUST NOT be strict.
router.post('/refresh-token', apiLimiter, refreshToken); 

// CORRECT (Already good): Authenticated routes use userLimiter
router.get('/me', authenticate, userLimiter, getMe);

// --- Google OAuth Routes ---

// FIX: Use the lenient apiLimiter instead of the old authLimiter
router.get(
    '/google',
    apiLimiter, 
    validateGoogleAuth, 
    (req, res, next) => {
        const { intent } = req.query;
        req.session.intent = intent;
        passport.authenticate('google', {
            scope: ['profile', 'email'],
        })(req, res, next);
    }
);

// FIX: Use the lenient apiLimiter instead of the old authLimiter
router.get(
    '/google/callback',
    apiLimiter,
    passport.authenticate('google', { failureRedirect: '/login/failed', session: false }),
    googleCallback
);

// --- Email Verification Routes ---

// FIX: Use the lenient apiLimiter instead of the old authLimiter
router.post('/verify-email', apiLimiter, validateVerifyEmail, verifyEmail);

// FIX: Use the lenient apiLimiter instead of the old authLimiter
router.post('/resend-verification', apiLimiter, validateResendVerificationEmail, resendVerificationEmail);

// --- Password Reset Routes ---

// FIX: Use the NEW bruteForceLimiter (keyed by email + IP)
router.post('/forgot-password', bruteForceLimiter, validateForgotPassword, forgotPassword);

// FIX: Use the NEW bruteForceLimiter (keyed by email + IP)
router.put('/reset-password', bruteForceLimiter, validateResetPassword, resetPassword);

// CORRECT (Already good): Authenticated routes use userLimiter
router.put(
    '/change-password',
    authenticate,   
    userLimiter,        
    validateChangePassword, 
    changePassword 
);

module.exports = router;