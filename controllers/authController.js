const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const generateTokens = require('../utils/generateTokens');

/**
 * @desc    Helper function to generate tokens and send the response.
 * Sets the refresh token in an httpOnly cookie and sends user
 * data and the access token in the JSON response.
 * @param   {object} user - The user object from MongoDB.
 * @param   {number} statusCode - The HTTP status code for the response.
 * @param   {object} res - The Express response object.
 */
const sendTokenResponse = (user, statusCode, res) => {
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    const cookieOptions = {
        // Expiry should be a future date. 7 days in milliseconds.
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        httpOnly: true, // Prevents client-side JS from accessing the cookie
        secure: process.env.NODE_ENV === 'production', // Only send cookie over HTTPS
        sameSite: 'strict', // Helps mitigate CSRF attacks
        path: '/',
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Send user data and the short-lived access token in the response
    res.status(statusCode).json({
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        userName: user.userName,
        email: user.email,
        role: user.role,
        avatarUrl: user.avatarUrl,
        token: accessToken,
    });
};

// @desc    Register a new user with email and password
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, userName, email, password } = req.body;

    if (!firstName || !lastName || !userName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields: firstName, lastName, userName, email, password.');
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
    });

    if (user) {
        sendTokenResponse(user, 201, res);
    } else {
        res.status(400);
        throw new Error('Invalid user data');
    }
});

// @desc    Authenticate user with email & password
// @route   POST /api/auth/login
// @access  Public
const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }
    
    if (user.authMethod !== 'local') {
        res.status(401);
        throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
    }

    if (!user.passwordHash) {
        res.status(401);
        throw new Error('Invalid credentials for this user.');
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (isMatch) {
        user.lastLogin = new Date();
        await user.save();
        sendTokenResponse(user, 200, res);
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Handle Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const googleCallback = asyncHandler(async (req, res) => {
    const user = req.user; // User is attached by Passport.js middleware
    const { accessToken, refreshToken } = generateTokens(user._id, user.role);

    const cookieOptions = {
        expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
    };

    res.cookie('refreshToken', refreshToken, cookieOptions);

    // Redirect to the frontend callback page, passing the access token
    res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${accessToken}`);
});

// @desc    Generate a new access token using a refresh token
// @route   POST /api/auth/refresh-token
// @access  Public (via cookie)
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

        // Issue a new short-lived access token
        const { accessToken } = generateTokens(user._id, user.role);
        
        // Respond with only the new access token
        res.json({
            token: accessToken,
        });

    } catch (error) {
        res.status(401);
        throw new Error('Not authorized, refresh token is invalid or has expired.');
    }
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
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

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
    // To log out, we clear the refresh token cookie.
    res.cookie('refreshToken', 'none', {
        expires: new Date(Date.now() + 10 * 1000), // Set expiry to the past
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
};