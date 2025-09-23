const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs'); // Import bcrypt here
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const passport = require('passport');

// @desc    Register a new user with email and password
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { firstName, lastName, userName, email, password, role } = req.body;

    if (!firstName || !lastName || !userName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields: firstName, lastName, userName, email, password.');
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
        res.status(400);
        throw new Error('User with this email already exists.');
    }

    // --- EXPLICIT HASHING ---
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const user = await User.create({
        firstName,
        lastName,
        userName,
        email,
        passwordHash, // Save the pre-hashed password
        authMethod: 'local',
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            email: user.email,
            role: user.role,
            token: generateToken(user._id, user.role),
        });
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

    // Fetch user and ensure passwordHash is included
    const user = await User.findOne({ email }).select('+passwordHash');

    if (!user) {
        res.status(401);
        throw new Error('Invalid email or password');
    }
    
    if (user.authMethod !== 'local') {
        res.status(401);
        throw new Error(`This account uses ${user.authMethod} sign-in. Please use that method to log in.`);
    }

    // Explicitly check if passwordHash exists before comparing
    if (!user.passwordHash) {
        res.status(401);
        throw new Error('Invalid credentials for this user.');
    }
    
    const isMatch = await bcrypt.compare(password, user.passwordHash);

    if (isMatch) {
        user.lastLogin = new Date();
        await user.save();

        res.json({
            _id: user._id,
            firstName: user.firstName,
            lastName: user.lastName,
            userName: user.userName,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
            token: generateToken(user._id, user.role),
        });
    } else {
        res.status(401);
        throw new Error('Invalid email or password');
    }
});

// @desc    Handle Google OAuth callback
// @route   GET /api/auth/google/callback
// @access  Public
const googleCallback = asyncHandler(async (req, res) => {
    const token = generateToken(req.user._id, req.user.role);
    res.redirect(`${process.env.FRONTEND_URL}/login/success?token=${token}`);
});

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
const getMe = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user._id);
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
        res.status(404); throw new Error('User not found');
    }
});

// @desc    Logout user
// @route   POST /api/auth/logout
// @access  Private
const logoutUser = asyncHandler(async (req, res) => {
    res.status(200).json({ message: 'Logout successful' });
});

module.exports = {
    registerUser,
    loginUser,
    googleCallback,
    getMe,
    logoutUser,
};