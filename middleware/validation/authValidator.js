const { body, query, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
// Define rules for registration
const validateRegister = [
    // firstName: Must exist, be a string, not be empty, and be sanitized
    body('firstName')
        .notEmpty().withMessage('First name is required.')
        .isString().withMessage('First name must be a string.')
        .trim()
        .escape(), 

    // lastName: Same as firstName
    body('lastName')
        .notEmpty().withMessage('Last name is required.')
        .isString().withMessage('Last name must be a string.')
        .trim()
        .escape(),

    // userName: Must exist, be alphanumeric, and be sanitized
    body('userName')
        .notEmpty().withMessage('Username is required.')
        .isAlphanumeric().withMessage('Username can only contain letters and numbers.')
        .trim(),

    // email: Must be a valid email format and normalized
    body('email')
        .notEmpty().withMessage('Email is required.')
        .isEmail().withMessage('Please provide a valid email address.')
        .normalizeEmail(), 

    // password: Must be strong
    body('password')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number.'),

    // intent: Optional, but if it exists, it must be one of these values
    body('intent')
        .optional()
        .isIn(['viewer', 'creator']).withMessage('Invalid user intent.'),

    // referralCode: Optional, sanitize it
    body('referralCode')
        .optional()
        .trim()
        .escape(),
        
    // 3. Add the error handler function to the end of the array
    handleValidationErrors
];

// Define rules for login
const validateLogin = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
        
    body('password')
        .notEmpty().withMessage('Password is required.'),
        
    handleValidationErrors
];

// Define rules for Forgot Password
const validateForgotPassword = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    handleValidationErrors
];

// Define rules for Reset Passwords
const validateResetPassword = [
    // 1. Check the URL query param, not the body
    query('token')
        .notEmpty().withMessage('Reset token is required.'),

    // 2. Use 'password' to match your controller, not 'newPassword'
    body('password') 
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number.'),
    
    handleValidationErrors
];

// Define rules for verify email
const validateVerifyEmail = [
    body('token')
        .notEmpty().withMessage('Verification token is required.'),
    handleValidationErrors
];

// Define rules for resend verification email
const validateResendVerificationEmail = [
    body('email')
        .isEmail().withMessage('Please provide a valid email.')
        .normalizeEmail(),
    handleValidationErrors
];

// Define rules for Google OAuth
const validateGoogleAuth = [
    query('intent')
        .notEmpty().withMessage('Auth intent is required.')
        .isIn(['viewer', 'creator']).withMessage('Invalid auth intent specified.'),

    handleValidationErrors
];

// Define rules for logout
const validateLogout = [
    handleValidationErrors
];

// Define rules for refresh token
const validateRefreshToken = [
    handleValidationErrors
];

// Define rules for social login
const validateSocialLogin = [
    body('provider')
        .notEmpty().withMessage('Social login provider is required.')
        .isIn(['google', 'facebook', 'twitter']).withMessage('Invalid social login provider.'),
    body('token')
        .notEmpty().withMessage('Social login token is required.'),
    handleValidationErrors
];

// Define rules for change password
const validateChangePassword = [
    body('currentPassword')
        .notEmpty().withMessage('Current password is required.'),
    body('newPassword')
        .isLength({ min: 8 }).withMessage('New password must be at least 8 characters long.')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
        .withMessage('New password must contain at least one uppercase letter, one lowercase letter, and one number.'),
    handleValidationErrors
];


module.exports = {
    validateRegister,
    validateLogin,
    validateForgotPassword,
    validateResetPassword,
    validateVerifyEmail,
    validateResendVerificationEmail,
    validateLogout,
    validateRefreshToken,
    validateSocialLogin,
    validateGoogleAuth,
    validateChangePassword,
};