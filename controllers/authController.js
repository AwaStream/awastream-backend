const asyncHandler = require('express-async-handler');
const bcrypt = require('bcryptjs'); // Import bcrypt here
const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const passport = require('passport');

// @desc    Register a new user with email and password
// @route   POST /api/auth/register
// @access  Public
const registerUser = asyncHandler(async (req, res) => {
    const { displayName, email, password } = req.body;

    if (!displayName || !email || !password) {
        res.status(400);
        throw new Error('Please provide all required fields: displayName, email, password.');
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
        displayName,
        email,
        passwordHash, // Save the pre-hashed password
        authMethod: 'local',
    });

    if (user) {
        res.status(201).json({
            _id: user._id,
            displayName: user.displayName,
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
            displayName: user.displayName,
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

// @desc    Authenticate with Google using an authorization code from the frontend
// @route   POST /api/auth/google
// @access  Public
const googleAuth = asyncHandler(async (req, res) => {
    const { code } = req.body;
    if (!code) {
        res.status(400);
        throw new Error("Google authorization code is required");
    }

    try {
        // Exchange the authorization code for tokens
        const { tokens } = await googleClient.getToken({
            code,
            client_id: process.env.GOOGLE_CLIENT_ID,
            client_secret: process.env.GOOGLE_CLIENT_SECRET,
            redirect_uri: 'postmessage', // Required for this flow
        });
        const idToken = tokens.id_token;

        const ticket = await googleClient.verifyIdToken({
            idToken,
            audience: process.env.GOOGLE_CLIENT_ID,
        });

        const { email, name, picture, sub: googleId } = ticket.getPayload();
        
        let user = await User.findOne({ googleId });

        if (!user) {
            // If no user with this googleId, check if one exists with the same email
            const existingEmailUser = await User.findOne({ email });
            if (existingEmailUser) {
                 res.status(400);
                 throw new Error(`Email ${email} is already registered. Please log in with your original method.`);
            }

            // Create a new user
            user = await User.create({
                googleId,
                displayName: name,
                email,
                avatarUrl: picture,
                authMethod: 'google',
                isEmailVerified: true,
            });
        }
        
        user.lastLogin = new Date();
        await user.save();

        res.json({
            _id: user._id,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            avatarUrl: user.avatarUrl,
            token: generateToken(user._id, user.role),
        });

    } catch (error) {
        console.error("Error during Google authentication:", error);
        res.status(500);
        throw new Error('An internal error occurred during Google authentication.');
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
            displayName: user.displayName,
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
    googleAuth,
    googleCallback,
    getMe,
    logoutUser,
};