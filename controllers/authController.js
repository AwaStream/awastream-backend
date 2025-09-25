// const asyncHandler = require('express-async-handler');
// const bcrypt = require('bcryptjs');
// const jwt = require('jsonwebtoken');
// const crypto = require('crypto');
// const User = require('../models/User');
// const generateTokens = require('../utils/generateTokens');
// const sendEmail = require('../utils/email/sendEmail');

// /**
//  * @desc    Helper function to generate tokens and send the final login/auth response.
//  * @param   {object} user - The user object from MongoDB.
//  * @param   {number} statusCode - The HTTP status code for the response.
//  * @param   {object} res - The Express response object.
//  */
// const sendTokenResponse = (user, statusCode, res) => {
//     const { accessToken, refreshToken } = generateTokens(user._id, user.role);

//     const cookieOptions = {
//         expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'none',
//         path: '/',
//     };

//     res.cookie('refreshToken', refreshToken, cookieOptions);

//     // Determine the redirect path based on the user's role
//     let redirectPath;
//     switch (user.role) {
//         case 'superadmin':
//             redirectPath = '/admin/dashboard';
//             break;
//         case 'creator':
//             redirectPath = '/dashboard';
//             break;
//         case 'viewer':
//             redirectPath = '/library';
//             break;
//         default:
//             redirectPath = '/'; // Fallback
//     }

//     // Send user data, access token, and the redirect path
//     res.status(statusCode).json({
//         _id: user._id,
//         firstName: user.firstName,
//         lastName: user.lastName,
//         userName: user.userName,
//         email: user.email,
//         role: user.role,
//         avatarUrl: user.avatarUrl,
//         token: accessToken,
//         redirectPath: redirectPath,
//     });
// };

// // @desc    Register a new user
// // @route   POST /api/auth/register
// // @access  Public
// const registerUser = asyncHandler(async (req, res) => {
//     const { firstName, lastName, userName, email, password, intent } = req.body;

//     if (!firstName || !lastName || !userName || !email || !password) {
//         res.status(400);
//         throw new Error('Please provide all required fields.');
//     }

//     const userExists = await User.findOne({ email });
//     if (userExists) {
//         res.status(400);
//         throw new Error('User with this email already exists.');
//     }

//     const salt = await bcrypt.genSalt(10);
//     const passwordHash = await bcrypt.hash(password, salt);

//     const user = await User.create({
//         firstName,
//         lastName,
//         userName,
//         email,
//         passwordHash,
//         authMethod: 'local',
//         role: intent === 'viewer' ? 'viewer' : 'creator',
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid user data');
//     }

//     const verificationToken = user.generateEmailVerificationToken();
//     await user.save(); 

//     const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

//     try {
//         await sendEmail({
//             subject: 'Verify Your AwaStream Account',
//             send_to: user.email,
//             template: 'emailVerification',
//             name: user.firstName,
//             link: verificationUrl,
//         });

//         res.status(201).json({
//             message: `Registration successful! A verification email has been sent to ${user.email}.`
//         });
//     } catch (error) {
//         user.emailVerificationToken = undefined;
//         user.emailVerificationTokenExpires = undefined;
//         await user.save();
//         res.status(500);
//         throw new Error('Email could not be sent. Please try registering again.');
//     }
// });

// // @desc    Authenticate user & get token
// // @route   POST /api/auth/login
// // @access  Public
// const loginUser = asyncHandler(async (req, res) => {
//     const { email, password } = req.body;

//     const user = await User.findOne({ email }).select('+passwordHash');

//     if (!user || !(await user.matchPassword(password))) {
//         res.status(401);
//         throw new Error('Invalid email or password');
//     }

//     if (!user.isEmailVerified) {
//         res.status(403);
//         throw new Error('Please verify your email address before logging in. You can request a new verification link.');
//     }

//     if (user.authMethod !== 'local') {
//         res.status(401);
//         throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
//     }

//     user.lastLogin = new Date();
//     await user.save();
//     sendTokenResponse(user, 200, res);
// });

// // @desc    Handle Google OAuth callback
// // @route   GET /api/auth/google/callback
// // @access  Public
// const googleCallback = asyncHandler(async (req, res) => {
//     const user = req.user; // User is attached by Passport.js middleware
//     const { accessToken, refreshToken } = generateTokens(user._id, user.role);

//     const cookieOptions = {
//         expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
//         httpOnly: true,
//         secure: process.env.NODE_ENV === 'production',
//         sameSite: 'none',
//         path: '/',
//     };

//     res.cookie('refreshToken', refreshToken, cookieOptions);
//     res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
// });

// // @desc    Verify user's email address
// // @route   POST /api/auth/verify-email
// // @access  Public
// const verifyEmail = asyncHandler(async (req, res) => {
//     const { token } = req.body;
//     if (!token) {
//         res.status(400);
//         throw new Error('Verification token is required.');
//     }

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

//     const user = await User.findOne({
//         emailVerificationToken: hashedToken,
//         emailVerificationTokenExpires: { $gt: Date.now() },
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired verification token. Please request a new one.');
//     }

//     user.isEmailVerified = true;
//     user.emailVerificationToken = undefined;
//     user.emailVerificationTokenExpires = undefined;
//     await user.save();

//     sendTokenResponse(user, 200, res);
// });

// // @desc    Resend email verification token
// // @route   POST /api/auth/resend-verification
// // @access  Public
// const resendVerificationEmail = asyncHandler(async (req, res) => {
//     const { email } = req.body;
//     if (!email) {
//         res.status(400);
//         throw new Error('Email is required.');
//     }

//     const user = await User.findOne({ email });

//     if (!user) {
//         res.status(404);
//         throw new Error('User with that email does not exist.');
//     }

//     if (user.isEmailVerified) {
//         res.status(400);
//         throw new Error('This account has already been verified.');
//     }

//     const verificationToken = user.generateEmailVerificationToken();
//     await user.save();
//     const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${verificationToken}`;

//     try {
//         await sendEmail({
//             subject: 'Resend: Verify Your AwaStream Account',
//             send_to: user.email,
//             template: 'emailVerification',
//             name: user.firstName,
//             link: verificationUrl,
//         });
//         res.status(200).json({ message: `A new verification email has been sent to ${user.email}.` });
//     } catch (error) {
//         res.status(500);
//         throw new Error('Email could not be sent. Please try again later.');
//     }
// });

// // @desc    Forgot password
// // @route   POST /api/auth/forgot-password
// // @access  Public
// const forgotPassword = asyncHandler(async (req, res) => {
//     const { email } = req.body;
//     if (!email) {
//         res.status(400);
//         throw new Error('Email is required.');
//     }
    
//     const user = await User.findOne({ email });

//     if (!user) {
//         res.status(404);
//         throw new Error('There is no user with that email address.');
//     }

//     const resetToken = user.generatePasswordResetToken();
//     await user.save();
//     const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

//     try {
//         await sendEmail({
//             subject: 'AwaStream Password Reset Request',
//             send_to: user.email,
//             template: 'passwordReset',
//             name: user.firstName,
//             link: resetUrl,
//         });
//         res.status(200).json({ message: 'Password reset link has been sent to your email.' });
//     } catch (error) {
//         user.resetPasswordToken = undefined;
//         user.resetPasswordExpires = undefined;
//         await user.save();
//         res.status(500);
//         throw new Error('Email could not be sent.');
//     }
// });

// // @desc    Reset password
// // @route   PUT /api/auth/reset-password
// // @access  Public
// const resetPassword = asyncHandler(async (req, res) => {
//     const { token } = req.query;
//     const { password } = req.body;

//     if (!token || !password) {
//         res.status(400);
//         throw new Error('Request must include a token and a new password.');
//     }

//     const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

//     const user = await User.findOne({
//         resetPasswordToken: hashedToken,
//         resetPasswordExpires: { $gt: Date.now() },
//     });

//     if (!user) {
//         res.status(400);
//         throw new Error('Invalid or expired password reset token.');
//     }

//     const salt = await bcrypt.genSalt(10);
//     user.passwordHash = await bcrypt.hash(password, salt);
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;
//     await user.save();

//     sendTokenResponse(user, 200, res);
// });


// // @desc    Generate a new access token using a refresh token
// // @route   POST /api/auth/refresh-token
// // @access  Public (via cookie)
// const refreshToken = asyncHandler(async (req, res) => {
//     const token = req.cookies.refreshToken;

//     if (!token) {
//         res.status(401);
//         throw new Error('Not authorized, no refresh token provided.');
//     }

//     try {
//         const decoded = jwt.verify(token, process.env.JWT_SECRET);
//         const user = await User.findById(decoded.id);

//         if (!user) {
//             res.status(401);
//             throw new Error('Not authorized, user not found for this token.');
//         }

//         const { accessToken } = generateTokens(user._id, user.role);
        
//         res.json({
//             token: accessToken,
//         });

//     } catch (error) {
//         res.status(401);
//         throw new Error('Not authorized, refresh token is invalid or has expired.');
//     }
// });

// // @desc    Get current logged in user
// // @route   GET /api/auth/me
// // @access  Private
// const getMe = asyncHandler(async (req, res) => {
//     const user = await User.findById(req.user.id);

//     if (user) {
//         res.json({
//             _id: user._id,
//             firstName: user.firstName,
//             lastName: user.lastName,
//             userName: user.userName,
//             email: user.email,
//             avatarUrl: user.avatarUrl,
//             role: user.role,
//         });
//     } else {
//         res.status(404);
//         throw new Error('User not found');
//     }
// });

// // @desc    Logout user
// // @route   POST /api/auth/logout
// // @access  Private
// const logoutUser = asyncHandler(async (req, res) => {
//     res.cookie('refreshToken', 'none', {
//         expires: new Date(Date.now() + 10 * 1000),
//         httpOnly: true,
//     });
//     res.status(200).json({ message: 'Logout successful' });
// });

// module.exports = {
//     registerUser,
//     loginUser,
//     googleCallback,
//     refreshToken,
//     getMe,
//     logoutUser,
//     verifyEmail,
//     resendVerificationEmail,
//     forgotPassword,
//     resetPassword,
// };



const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/User');
const generateTokens = require('../utils/generateTokens');
const sendEmail = require('../utils/email/sendEmail');

// --- sendTokenResponse and other functions remain the same ---
const sendTokenResponse = (user, statusCode, res) => {
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    let redirectPath;
    switch (user.role) {
        case 'superadmin':
            redirectPath = '/admin/dashboard';
            break;
        case 'creator':
            redirectPath = '/dashboard';
            break;
        case 'viewer':
            redirectPath = '/library';
            break;
        default:
            redirectPath = '/';
    }

    res.status(statusCode).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        token: accessToken,
        redirectPath: redirectPath,
    });
};

const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, userName, email, password, intent } = req.body;

    if (!firstName || !lastName || !userName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
        firstName,
        lastName,
        userName,
        email,
        passwordHash,
        authMethod: 'local',
        role: intent === 'viewer' ? 'viewer' : 'creator',
    });

    if (!user) {
        res.status(400);
        throw new Error('Invalid user data');
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;

    try {
        // --- FIX: Added sent_from and reply_to for proper email formatting ---
        await sendEmail({
            subject: 'Verify Your AwaStream Account',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'emailVerification',
            name: user.firstName,
            link: verificationUrl,
        });

        res.status(201).json({
            message: `Registration successful! A verification email has been sent to ${user.email}.`
        });
    } catch (error) {
        user.emailVerificationToken = undefined;
        user.emailVerificationTokenExpires = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent. Please check server configuration.');
    }
});

// ... loginUser, googleCallback, and verifyEmail are unchanged ...
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+passwordHash');
    if (!user || !(await user.matchPassword(password))) {
        res.status(401);
        throw new Error('Invalid email or password');
    }
    if (!user.isEmailVerified) {
        res.status(403);
        throw new Error('Please verify your email address before logging in. You can request a new verification link.');
    }
    if (user.authMethod !== 'local') {
        res.status(401);
        throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
    }
    user.lastLogin = new Date();
    await user.save();
    sendTokenResponse(user, 200, res);
});
const googleCallback = asyncHandler(async (req, res) => {
    const user = req.user;
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);
    const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'none',
        path: '/',
    };
    res.cookie('refreshToken', refreshToken, cookieOptions);
    res.redirect(`${process.env.AWASTREAM_FRONTEND_HOST}/auth/callback?token=${accessToken}`);
});
const verifyEmail = asyncHandler(async (req, res) => {
    const { token } = req.body;
    if (!token) {
        res.status(400);
        throw new Error('Verification token is required.');
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationTokenExpires: { $gt: Date.now() },
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired verification token. Please request a new one.');
    }
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationTokenExpires = undefined;
    await user.save();
    sendTokenResponse(user, 200, res);
});


const resendVerificationEmail = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('Email is required.');
    }

    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('User with that email does not exist.');
    }
    if (user.isEmailVerified) {
        res.status(400);
        throw new Error('This account has already been verified.');
    }

    const verificationToken = user.generateEmailVerificationToken();
    await user.save();
    const verificationUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/verify-email?token=${verificationToken}`;

    try {
        // --- FIX: Added sent_from and reply_to for proper email formatting ---
        await sendEmail({
            subject: 'Resend: Verify Your AwaStream Account',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'emailVerification',
            name: user.firstName,
            link: verificationUrl,
        });
        res.status(200).json({ message: `A new verification email has been sent to ${user.email}.` });
    } catch (error) {
        res.status(500);
        throw new Error('Email could not be sent. Please try again later.');
    }
});

const forgotPassword = asyncHandler(async (req, res) => {
    const { email } = req.body;
    if (!email) {
        res.status(400);
        throw new Error('Email is required.');
    }

    const user = await User.findOne({ email });
    if (!user) {
        res.status(404);
        throw new Error('There is no user with that email address.');
    }

    const resetToken = user.generatePasswordResetToken();
    await user.save();
    const resetUrl = `${process.env.AWASTREAM_FRONTEND_HOST}/reset-password?token=${resetToken}`;

    try {
        // --- FIX: Added sent_from and reply_to for proper email formatting ---
        await sendEmail({
            
            subject: 'AwaStream Password Reset Request',
            send_to: user.email,
            sent_from: `${process.env.AWASTREAM_FROM_NAME || 'AwaStream Team'} <${process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com'}>`,
            reply_to: process.env.AWASTREAM_FROM_EMAIL || 'no-reply@awastream.com',
            template: 'passwordReset',
            name: user.firstName,
            link: resetUrl,
        });
        res.status(200).json({ message: 'Password reset link has been sent to your email.' });
    } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpires = undefined;
        await user.save();
        res.status(500);
        throw new Error('Email could not be sent.');
    }
});

// ... resetPassword, refreshToken, getMe, and logoutUser are unchanged ...
const resetPassword = asyncHandler(async (req, res) => {
    const { token } = req.query;
    const { password } = req.body;
    if (!token || !password) {
        res.status(400);
        throw new Error('Request must include a token and a new password.');
    }
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpires: { $gt: Date.now() },
    });
    if (!user) {
        res.status(400);
        throw new Error('Invalid or expired password reset token.');
    }
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();
    sendTokenResponse(user, 200, res);
});
const refreshToken = asyncHandler(async (req, res) => {
    const token = req.cookies.refreshToken;
    if (!token) {
        res.status(401);
        throw new Error('Not authorized, no refresh token provided.');
    }
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        if (!user) {
            res.status(401);
            throw new Error('Not authorized, user not found for this token.');
        }
        const { accessToken } = generateTokens(user._id, user.role);
        res.json({
            token: accessToken,
        });
    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, refresh token is invalid or has expired.');
    }
});
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user.id);
    if (user) {
        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            email: user.email,
            avatarUrl: user.avatarUrl,
            role: user.role,
        });
    } else {
        res.status(404);
        throw new Error('User not found');
    }
});
const logoutUser = asyncHandler(async (req, res) => {
    res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 10 * 1000),
        httpOnly: true,
    });
    res.status(200).json({ message: 'Logout successful' });
});

module.exports = {
    registerUser,
    loginUser,
    googleCallback,
    refreshToken,
    getMe,
    logoutUser,
    verifyEmail,
    resendVerificationEmail,
    forgotPassword,
    resetPassword,
};