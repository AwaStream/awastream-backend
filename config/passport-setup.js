const passport = require('passport');
const crypto = require('crypto')
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');
const { uploadExternalImageToCloudinary } = require('../utils/cloudinary');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: '/api/v1/auth/google/callback',
            passReqToCallback: true, // Required to access req.query.state
        },
        async (req, accessToken, refreshToken, profile, done) => {
            const { id, name, emails, photos } = profile;
            const email = emails[0].value;

            const originalAvatarUrl = photos ? photos[0].value : null;

            let avatarUrl = null;
            if (originalAvatarUrl) {
                try {
                    avatarUrl = await uploadExternalImageToCloudinary(originalAvatarUrl);
                } catch (uploadError) {
                    console.error("Cloudinary upload failed:", uploadError.message);
                    avatarUrl = null; 
                }
            }

            // --- 1. Path/Intent Extraction (Must run first for ALL cases) ---
            let userIntent = 'viewer';
            let postAuthPath = null;
            const allowedIntents = ['creator', 'viewer'];

            if (req.query.state) {
                try {
                    const state = JSON.parse(Buffer.from(req.query.state, 'base64').toString('ascii'));
                    if (state.intent && allowedIntents.includes(state.intent)) {
                        userIntent = state.intent;
                    }
                    if (state.path) {
                        postAuthPath = state.path; // Capture path from frontend state
                    }
                } catch (e) {
                    console.error("Failed to parse state:", e.message);
                }
            }
            
            try {
                // 2. Check if this Google ID already exists (LOGIN)
                let user = await User.findOne({ googleId: id });

                if (user) {
                    user.lastLogin = new Date();
                    await user.save();
                    // Attach path for EXISTING users
                    user.postAuthPath = postAuthPath; 
                    return done(null, user);
                }

                // 3. Check if the email is already in use (ACCOUNT LINKING)
                const existingEmailUser = await User.findOne({ email });

                if (existingEmailUser) {
                    if (existingEmailUser.authMethod === 'local') {
                        existingEmailUser.googleId = id;
                        existingEmailUser.authMethod = 'google'; 
                        existingEmailUser.isEmailVerified = true; 
                        existingEmailUser.lastLogin = new Date();
                        
                        // Attach path for LINKED users
                        existingEmailUser.postAuthPath = postAuthPath;
                        await existingEmailUser.save();
                        return done(null, existingEmailUser);
                    } else {
                        return done(new Error(`This email (${email}) is already linked to another social account.`), null);
                    }
                }

                // 4. Create a new user (REGISTER)
                const firstName = name.givenName || 'User';
                const lastName = name.familyName || ''; 
                const userName = email.split('@')[0] + '-' + crypto.randomBytes(4).toString('hex');

                const newUser = await User.create({
                    googleId: id,
                    firstName: firstName,
                    lastName: lastName, 
                    userName: userName,
                    email: email,
                    avatarUrl: avatarUrl,
                    authMethod: 'google',
                    isEmailVerified: true,
                    lastLogin: new Date(),
                    role: userIntent, 
                });
                newUser.postAuthPath = postAuthPath;
                return done(null, newUser);

            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (err) {
        done(err, null);
    }
});
